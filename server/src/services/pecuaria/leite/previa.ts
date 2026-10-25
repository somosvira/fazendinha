import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { contextoAnimalLeite } from "./populacao.calc.js";
import { configuracaoDTO } from "./configuracoes.js";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import {
  previaHistoricaLeiteSchema,
  type PreviaHistoricaLeiteInput,
} from "./previa.schemas.js";
const normalizar = (s: string) =>
  s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
/** Prévia somente leitura. Nenhuma ordenha histórica entra automaticamente no estoque atual. */
export async function preverHistoricoLeiteTx(
  tx: Prisma.TransactionClient,
  propriedadeId: number,
  dados: PreviaHistoricaLeiteInput,
) {
  const input = previaHistoricaLeiteSchema.parse(dados);
  if (new Date(input.fim) > hojeFazendaDate())
    throw new RebanhoError(
      "VALIDACAO",
      "O lote histórico deve terminar até hoje",
    );
  const sitio = await tx.propriedade.findUnique({
    where: { id: propriedadeId },
    select: { id: true, nome: true },
  });
  if (!sitio) throw new RebanhoError("NAO_ENCONTRADO", "Sítio não encontrado");
  const animais = await tx.animal.findMany({
    where: { brinco: { in: [...new Set(input.linhas.map((l) => l.brinco))] } },
    include: { destinos: true, localizacoes: true, baixas: { where: { estornadaEm: null } } },
  });
  const lactacoes = await tx.lactacaoAnimal.findMany({
    where: { animalId: { in: animais.map((a) => a.id) } },
  });
  const configuracoes = await tx.configuracaoOrdenha.findMany({
    where: { propriedadeId, vigenteDesde: { lte: new Date(input.fim) } },
    include: { ordenhas: { orderBy: { ordem: "asc" } } },
    orderBy: { vigenteDesde: "desc" },
  });
  const dias = await tx.diaProducaoLeite.findMany({
    where: {
      propriedadeId,
      dataOperacional: {
        gte: new Date(input.inicio),
        lte: new Date(input.fim),
      },
    },
    include: {
      configuracao: { include: { ordenhas: { orderBy: { ordem: "asc" } } } },
      sessoes: true,
      participantes: {
        include: {
          medicoes: {
            include: {
              origensEstoque: {
                where: { ativo: true },
                select: { entradaId: true },
              },
            },
          },
        },
      },
    },
  });
  const periodo = { gte: new Date(input.inicio), lte: new Date(input.fim) };
  const [movimentos, vendas] = await Promise.all([
    tx.movimentoEstoque.count({
      where: {
        propriedadeId,
        data: periodo,
        metodoValorizacao: "LEITE_FIFO_V1",
      },
    }),
    tx.versaoComercialVendaLeite.count({
      where: { retirada: { propriedadeId, data: periodo } },
    }),
  ]);
  const porBrinco = new Map<string, typeof animais>();
  for (const animal of animais)
    porBrinco.set(animal.brinco, [
      ...(porBrinco.get(animal.brinco) ?? []),
      animal,
    ]);
  const porData = new Map(
    dias.map((d) => [d.dataOperacional.toISOString().slice(0, 10), d]),
  );
  const contagemOrigem = new Map<string, number>();
  for (const linha of input.linhas)
    contagemOrigem.set(
      linha.origemId,
      (contagemOrigem.get(linha.origemId) ?? 0) + 1,
    );
  const chaves = new Set<string>();
  const linhas = input.linhas.map((linha, indice) => {
    const base = {
      linha: indice + 1,
      origemId: linha.origemId,
      brinco: linha.brinco,
      data: linha.data,
      ordenha: linha.ordenha,
      estado: linha.estado,
      litros: linha.litros,
      responsavelFonte: linha.responsavelFonte ?? null,
    };
    const problema = (situacao: string, motivo: string) => ({
      ...base,
      situacao,
      motivo,
      animalId: null as string | null,
      posicaoId: null as string | null,
      pendencias: [] as string[],
    });
    if (contagemOrigem.get(linha.origemId) !== 1)
      return problema(
        "DUPLICADO_NO_LOTE",
        "Identificador de origem repetido no arquivo",
      );
    const candidatos = porBrinco.get(linha.brinco) ?? [];
    if (candidatos.length !== 1)
      return problema(
        "ANIMAL_NAO_CONCILIADO",
        candidatos.length
          ? "Brinco ambíguo: informe um mapa conferido"
          : "Animal não localizado pelo brinco literal",
      );
    const animal = candidatos[0],
      data = new Date(linha.data);
    let contexto: ReturnType<typeof contextoAnimalLeite>;
    try {
      contexto = contextoAnimalLeite(animal, lactacoes, propriedadeId, data);
    } catch (e) {
      return problema(
        "CONTEXTO_INCOMPATIVEL",
        e instanceof Error ? e.message : "Contexto histórico inválido",
      );
    }
    const dia = porData.get(linha.data);
    const config = configuracaoDTO(
      dia?.configuracao ??
        configuracoes.find((c) => c.vigenteDesde <= data) ??
        null,
      propriedadeId,
    );
    const posicoes = config.ordenhas.filter(
      (o) => normalizar(o.nome) === normalizar(linha.ordenha),
    );
    if (posicoes.length !== 1)
      return problema(
        "ORDENHA_NAO_CONCILIADA",
        "Rótulo de ordenha ausente ou ambíguo na rotina vigente; confira o mapa histórico",
      );
    const posicao = posicoes[0],
      chave = `${linha.data}:${animal.id}:${posicao.posicaoId}`;
    if (chaves.has(chave))
      return problema(
        "DUPLICADO_NO_LOTE",
        "Duas linhas representam a mesma medição; concilie a fonte antes de importar",
      );
    chaves.add(chave);
    const participante = dia?.participantes.find(
        (p) => p.animalId === animal.id,
      ),
      sessao = dia?.sessoes.find((s) => s.posicaoId === posicao.posicaoId);
    const medicao = participante?.medicoes.find(
      (m) => m.sessaoId === sessao?.id,
    );
    let situacao = "NOVO_REGISTRO",
      motivo = "Pronto para conferência; esta prévia não grava fatos";
    if (participante?.excluidoEm) {
      situacao = "CONFLITO_EXISTENTE";
      motivo = "Participante excluído na folha existente; revise o histórico";
    } else if (medicao) {
      const igual =
        medicao.estado === linha.estado &&
        (medicao.litros === null
          ? linha.litros === null
          : linha.litros !== null && medicao.litros.eq(linha.litros)) &&
        (medicao.motivo ?? null) === (linha.motivo ?? null);
      situacao = igual ? "JA_REGISTRADO" : "CONFLITO_EXISTENTE";
      motivo = igual
        ? "Mesma medição já existe; não deve ser inserida novamente"
        : medicao.origensEstoque.length
          ? "Medição diferente com origem de estoque confirmada; exige regularização"
          : "Medição existente diferente; exige decisão explícita, sem sobrescrever";
    }
    return {
      ...base,
      animalId: animal.id,
      posicaoId: posicao.posicaoId,
      situacao,
      motivo,
      pendencias: contexto.pendencias,
    };
  });
  const novos = linhas.filter((l) => l.situacao === "NOVO_REGISTRO");
  const totais = Object.fromEntries(
    [...new Set(linhas.map((l) => l.situacao))].map((s) => [
      s,
      linhas.filter((l) => l.situacao === s).length,
    ]),
  );
  return {
    propriedade: sitio,
    periodo: { inicio: input.inicio, fim: input.fim },
    origemArquivo: input.origemArquivo,
    unidade: input.unidade,
    referenciaUnidade: input.referenciaUnidade,
    assinaturaFonte: createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex"),
    linhas,
    totais,
    litrosNovosMedidos: novos
      .filter((l) => l.estado === "MEDIDO")
      .reduce((s, l) => s.plus(l.litros!), new Prisma.Decimal(0))
      .toString(),
    conferenciaSemConflitos: linhas.every(
      (l) =>
        ["NOVO_REGISTRO", "JA_REGISTRADO"].includes(l.situacao) &&
        l.pendencias.length === 0,
    ),
    conciliacao: {
      movimentosLeiteNoPeriodo: movimentos,
      versoesVendaNoPeriodo: vendas,
      estoqueAlterado: false,
      financeiroAlterado: false,
      importacaoExecutada: false,
    },
    avisos: [
      "Prévia somente leitura; registros novos ainda não foram importados",
      "Registros repetidos não devem gerar outra medição",
      "Não confirmar no estoque leite histórico já vendido, servido ou descartado",
      "Conferir saldo inicial, destinações e operações existentes antes de qualquer carga física",
      "A assinatura identifica o conteúdo recebido; não certifica a unidade nem substitui conferência da fonte",
    ],
  };
}
export function preverHistoricoLeite(
  propriedadeId: number,
  input: PreviaHistoricaLeiteInput,
) {
  return prisma.$transaction(
    (tx) => preverHistoricoLeiteTx(tx, propriedadeId, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
