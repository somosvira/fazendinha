import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import { calcularElegibilidadesDoConjunto, type DadosElegibilidade, type ElegibilidadeNaData } from "./elegibilidade.calc.js";
import { parametrosElegibilidadeSchema, type CriarPoliticaElegibilidadeInput, type VincularPoliticaCicloInput,
  type DecidirElegibilidadeCicloInput } from "./elegibilidade.schemas.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
function erro(message: string, campo?: string): never { throw new RebanhoError("VALIDACAO", message, campo); }

export async function criarPoliticaElegibilidade(input: CriarPoliticaElegibilidadeInput, usuarioId: number | null) {
  const parametros = parametrosElegibilidadeSchema.parse(input.parametros);
  return transacaoPecuaria(async tx => {
    // Esta trava só é usada na configuração; não se combina com travas de animais.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-politica-elegibilidade:${input.propriedadeId}`}))`;
    return operacaoIdempotenteTx(tx, input, usuarioId, "POLITICA_ELEGIBILIDADE", async () => {
      const anterior = await tx.politicaElegibilidadeReprodutiva.findFirst({ where: { propriedadeId: input.propriedadeId }, orderBy: { versao: "desc" } });
      if (anterior && dia(input.vigenteDesde) <= anterior.vigenteDesde) erro("Nova vigência deve ser posterior à última versão; ciclos vinculados conservam sua política", "vigenteDesde");
      const criada = await tx.politicaElegibilidadeReprodutiva.create({ data: {
        propriedadeId: input.propriedadeId, versao: (anterior?.versao ?? 0) + 1, vigenteDesde: dia(input.vigenteDesde),
        parametros: parametros as Prisma.InputJsonValue, criadoPorId: usuarioId,
      } });
      await auditar(tx, { entidade: "PoliticaElegibilidadeReprodutiva", entidadeId: criada.id, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criada });
      return criada;
    });
  });
}
export function listarPoliticasElegibilidade(propriedadeId: number) {
  return prisma.politicaElegibilidadeReprodutiva.findMany({ where: { propriedadeId }, orderBy: { versao: "desc" } });
}

/** O chamador trava o animal. Deve participar da mesma transação que cria o parto. */
export async function vincularPoliticaCicloTx(tx: Prisma.TransactionClient, input: {
  animalId: string; propriedadeId: number; partoId?: string; situacaoInicialId?: string;
}, usuarioId: number | null) {
  if (Boolean(input.partoId) === Boolean(input.situacaoInicialId)) erro("Informe parto ou situação inicial", "partoId");
  const chaveCiclo = input.partoId ? `PARTO:${input.partoId}` : "INICIAL";
  const existente = await tx.vinculoPoliticaCiclo.findUnique({ where: { animalId_chaveCiclo: { animalId: input.animalId, chaveCiclo } } });
  if (existente) {
    if (existente.propriedadeId !== input.propriedadeId) erro("O ciclo já tem vínculo no sítio de origem; sua política acompanha o animal", "propriedadeId");
    return existente;
  }
  let inicioCiclo: Date;
  if (input.partoId) {
    const parto = await tx.partoAnimal.findFirst({ where: { id: input.partoId, animalId: input.animalId, status: "VALIDO" } });
    if (!parto) erro("Parto válido do animal não encontrado", "partoId");
    inicioCiclo = parto.data;
  } else {
    const inicial = await tx.situacaoInicialReprodutiva.findFirst({ where: { id: input.situacaoInicialId, animalId: input.animalId, status: "VALIDO" } });
    if (!inicial) erro("Situação inicial válida do animal não encontrada", "situacaoInicialId");
    inicioCiclo = inicial.data;
    if (await tx.partoAnimal.count({ where: { animalId: input.animalId, status: "VALIDO", data: { lte: inicial.data } } })) erro("Situação inicial não substitui ciclo iniciado por parto", "situacaoInicialId");
  }
  const animal = await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, inicioCiclo);
  if (animal.sexo !== "F") erro("Elegibilidade reprodutiva exige fêmea", "animalId");
  const politica = await tx.politicaElegibilidadeReprodutiva.findFirst({ where: { propriedadeId: input.propriedadeId, vigenteDesde: { lte: inicioCiclo } }, orderBy: { vigenteDesde: "desc" } });
  const criado = await tx.vinculoPoliticaCiclo.create({ data: {
    animalId: input.animalId, propriedadeId: input.propriedadeId, chaveCiclo, partoId: input.partoId ?? null, situacaoInicialId: input.situacaoInicialId ?? null,
    inicioCiclo, politicaId: politica?.id ?? null, criadoPorId: usuarioId,
  } });
  await auditar(tx, { entidade: "VinculoPoliticaCiclo", entidadeId: criado.id, animalId: input.animalId, propriedadeId: input.propriedadeId,
    acao: "VINCULO_POLITICA_CICLO", usuarioId, depois: { ...criado, situacaoInicialId: input.situacaoInicialId ?? null,
      origemInicio: input.partoId ? "PARTO" : "SITUACAO_INICIAL_NAO_COMPROVA_PARTO_ANTERIOR" } });
  return criado;
}
export function vincularPoliticaCiclo(input: VincularPoliticaCicloInput, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, [input.animalId]);
    return operacaoIdempotenteTx(tx, input, usuarioId, "VINCULO_POLITICA_CICLO", () => vincularPoliticaCicloTx(tx, input, usuarioId));
  });
}

export function decidirElegibilidadeCiclo(input: DecidirElegibilidadeCicloInput, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    const referencia = await tx.vinculoPoliticaCiclo.findUnique({ where: { id: input.vinculoCicloId } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Ciclo não encontrado");
    await travarAnimais(tx, [referencia.animalId]);
    await conferirAnimalNoFato(tx, referencia.animalId, input.propriedadeId, dia(input.data));
    return operacaoIdempotenteTx(tx, input, usuarioId, "DECISAO_ELEGIBILIDADE_CICLO", async () => {
      if (dia(input.data) < referencia.inicioCiclo) erro("Decisão antecede o ciclo", "data");
      const parto = await tx.partoAnimal.findFirst({ where: { animalId: referencia.animalId, status: "VALIDO", data: { lte: dia(input.data) } }, orderBy: { data: "desc" } });
      if ((parto ? `PARTO:${parto.id}` : "INICIAL") !== referencia.chaveCiclo) erro("Decisão pertence a outro ciclo na data informada", "vinculoCicloId");
      if (input.tipo === "LIBERAR" ? (!input.aptaDesde || input.aptaDesde < input.data) : input.aptaDesde !== null) erro("Apta desde incompatível com a decisão", "aptaDesde");
      const criada = await tx.decisaoElegibilidadeCiclo.create({ data: {
        vinculoCicloId: referencia.id, data: dia(input.data), tipo: input.tipo, aptaDesde: input.aptaDesde ? dia(input.aptaDesde) : null,
        motivo: input.motivo, criadoPorId: usuarioId,
      } });
      await auditar(tx, { entidade: "DecisaoElegibilidadeCiclo", entidadeId: criada.id, animalId: referencia.animalId,
        propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criada });
      return criada;
    });
  });
}
export function anularDecisaoElegibilidade(id: string, input: { chave: string; propriedadeId: number; motivo: string }, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    const antes = await tx.decisaoElegibilidadeCiclo.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Decisão não encontrada");
    const vinculo = await tx.vinculoPoliticaCiclo.findUniqueOrThrow({ where: { id: antes.vinculoCicloId } });
    await travarAnimais(tx, [vinculo.animalId]);
    await conferirAnimalNoFato(tx, vinculo.animalId, input.propriedadeId, antes.data);
    return operacaoIdempotenteTx(tx, { ...input, id }, usuarioId, "ANULACAO_DECISAO_ELEGIBILIDADE", async () => {
      const atual = await tx.decisaoElegibilidadeCiclo.findUniqueOrThrow({ where: { id } });
      if (atual.status !== "VALIDO") throw new RebanhoError("CONFLITO", "Decisão já anulada");
      const depois = await tx.decisaoElegibilidadeCiclo.update({ where: { id }, data: { status: "ANULADO", anuladoEm: new Date(), motivoAnulacao: input.motivo } });
      await auditar(tx, { entidade: "DecisaoElegibilidadeCiclo", entidadeId: id, animalId: vinculo.animalId, propriedadeId: input.propriedadeId, acao: "ANULACAO", usuarioId, antes: atual, depois });
      return depois;
    });
  });
}

/** Carrega o histórico até a maior referência da janela, sem consultas por animal/dia. */
export async function carregarDadosElegibilidadeTx(tx: Prisma.TransactionClient, ids: readonly string[], ate: Date): Promise<DadosElegibilidade> {
  const animalIds = [...new Set(ids)];
  const animalId = { in: animalIds };
  const fatos = { animalId, status: "VALIDO" as const, data: { lte: ate } };
  const [animais, partos, tentativas, lactacoes, gestacoes, localizacoes, avaliacoes, iniciais, vinculos, restricoes, papeis, baixas] = await Promise.all([
    tx.animal.findMany({ where: { id: { in: animalIds } }, select: { id: true, sexo: true, dataEntrada: true, partosAntesDaEntrada: true } }),
    tx.partoAnimal.findMany({ where: fatos }),
    tx.tentativaReprodutiva.findMany({ where: fatos }),
    tx.lactacaoAnimal.findMany({ where: { animalId, inicio: { lte: ate } } }),
    tx.gestacaoAnimal.findMany({ where: { animalId, status: "VALIDO", confirmadaEm: { lte: ate } } }),
    tx.localizacaoAnimal.findMany({ where: { animalId, desde: { lte: ate } } }),
    tx.avaliacaoReprodutiva.findMany({ where: fatos }),
    tx.situacaoInicialReprodutiva.findMany({ where: fatos }),
    tx.vinculoPoliticaCiclo.findMany({ where: { animalId } }),
    tx.restricaoReprodutiva.findMany({ where: fatos }),
    tx.periodoReprodutivoAnimal.findMany({ where: { animalId, revogadoEm: null, inicio: { lte: ate } } }),
    tx.baixaAnimal.findMany({ where: { animalId, estornadaEm: null, data: { lte: ate } } }),
  ]);
  const [politicas, decisoes] = await Promise.all([
    tx.politicaElegibilidadeReprodutiva.findMany({ where: { id: { in: vinculos.flatMap(v => v.politicaId ? [v.politicaId] : []) } } }),
    tx.decisaoElegibilidadeCiclo.findMany({ where: { vinculoCicloId: { in: vinculos.map(v => v.id) }, data: { lte: ate } } }),
  ]);
  const crias=partos.length?await tx.criaParto.findMany({where:{partoId:{in:partos.map(p=>p.id)}},select:{partoId:true,viva:true}}):[];
  return { animais, partos:partos.map(p=>({...p,crias:crias.filter(c=>c.partoId===p.id)})), tentativas, lactacoes, gestacoes, localizacoes, avaliacoes, iniciais, vinculos, restricoes, papeis, baixas, politicas, decisoes };
}
/** O chamador autoriza os IDs pela localização na data. A consulta nunca congela vínculos. */
export async function obterElegibilidadesNaDataTx(tx: Prisma.TransactionClient, ids: readonly string[], propriedadeId: number, referencia: Date): Promise<Map<string, ElegibilidadeNaData>> {
  if (!ids.length) return new Map();
  return calcularElegibilidadesDoConjunto(await carregarDadosElegibilidadeTx(tx, ids, referencia), propriedadeId, referencia);
}
export async function consultarElegibilidadeNaData(animalId: string, propriedadeId: number, data: string) {
  return transacaoPecuaria(async tx => {
    await conferirAnimalNoFato(tx, animalId, propriedadeId, dia(data));
    return (await obterElegibilidadesNaDataTx(tx, [animalId], propriedadeId, dia(data))).get(animalId)!;
  });
}
