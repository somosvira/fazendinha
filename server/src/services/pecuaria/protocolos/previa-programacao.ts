import { Prisma, type UnidadeMedida } from "@prisma/client";
import { obterSaldo } from "../consumo.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { preverAutomacoesAdesao } from "./automacao.js";
import { z } from "zod";
import { transacaoPecuaria, timeoutTransacaoAnimais } from "../transacao.js";
import { AvisoAptidaoProgramacao, obterElegibilidadesNaDataTx } from "../reproducao/elegibilidade.js";
import { obterContextosAnimaisNaDataTx } from "../reproducao/contexto-animal.js";
import { conferirDisponibilidadeTx } from "../reproducao/registros.js";
import { dataDisponibilidadeIatf, lerDataIatf } from "../reproducao/horarios.calc.js";
import { RebanhoError } from "../rebanho/regras.js";
import { previaParticipacaoIndividualSchema } from "./operacao.schemas.js";
import { preverParticipacaoIndividual } from "./operacao.js";

export const previaProgramacaoSchema = previaParticipacaoIndividualSchema.omit({ tipo: true, animalId: true }).extend({
  aptidaoComoAviso: z.boolean().optional(),
  cienciaSanitaria: z.boolean().optional(),
  animaisIds: z.array(z.string().uuid()).min(1).refine(ids => new Set(ids).size === ids.length, "Selecione animais distintos"),
});
/** Mesma versão e início para o grupo: consulta o calendário uma vez, sem escrever fatos. */
export async function preverProgramacaoColetiva(entrada: unknown) {
  const input = previaProgramacaoSchema.parse(entrada);
  const { animaisIds, cienciaSanitaria, aptidaoComoAviso, ...calendario } = input;
  const referencia = dataDisponibilidadeIatf(lerDataIatf(input.inicioReferencia));
  const { participantes, avisosAptidao, impedimentos } = await transacaoPecuaria(async tx => {
    const encontrados = await tx.animal.findMany({
      where: { id: { in: animaisIds }, localizacoes: { some: { propriedadeId: input.propriedadeId, ate: null } }, baixas: { none: { estornadaEm: null } } },
      select: { id: true, brinco: true, nome: true, localizacoes: { where: { propriedadeId: input.propriedadeId, desde: { lte: referencia }, OR: [{ ate: null }, { ate: { gt: referencia } }] }, select: { lote: { select: { nome: true } } }, take: 1 } },
    });
    const porId = new Map(encontrados.map(animal => [animal.id, animal]));
    const idsComLocalNaData = encontrados.filter(a => a.localizacoes.length > 0).map(a => a.id);
    const [contextos, aptidoes] = await Promise.all([
      obterContextosAnimaisNaDataTx(tx, idsComLocalNaData, referencia),
      obterElegibilidadesNaDataTx(tx, idsComLocalNaData, input.propriedadeId, referencia),
    ]);
    const participantes = [];
    const avisosAptidao: { animalId: string; mensagem: string; descricao: string; motivos: string[] }[] = [];
    const impedimentos: { animalId: string; descricao: string; codigo: string }[] = [];
    for (const id of animaisIds) {
      const animal = porId.get(id);
      if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Um ou mais animais não estão disponíveis neste sítio. Atualize a seleção.");
      try {
        await conferirDisponibilidadeTx(tx, id, input.propriedadeId, referencia, "IATF", cienciaSanitaria);
      } catch (erro) {
        if (!(erro instanceof RebanhoError)) throw erro;
        const identificacao = animal.nome ? `${animal.brinco} · ${animal.nome}` : animal.brinco;
        const mensagem = `${identificacao}: ${erro.message}`;
        if (!aptidaoComoAviso) throw new RebanhoError(erro.code, mensagem, erro.campo);
        if (erro instanceof AvisoAptidaoProgramacao) avisosAptidao.push({ animalId: id, mensagem, descricao: erro.message, motivos: erro.motivos });
        else impedimentos.push({ animalId: id, descricao: erro.message, codigo: erro.code });
      }
      const contexto = contextos.get(id);
      participantes.push({ id: animal.id, brinco: animal.brinco, nome: animal.nome, loteNome: animal.localizacoes?.[0]?.lote?.nome ?? null,
        situacao: contexto?.situacaoReprodutiva ?? null, situacaoProdutiva: contexto?.situacaoProdutiva ?? null, del: contexto?.del ?? null,
        ultimoParto: contexto?.ultimoParto?.data ?? null, partos: contexto?.partosRealizados ?? null, tentativasCiclo: contexto?.tentativasCiclo ?? null,
        aptidao: aptidoes.get(id)?.aptidao.estado ?? null });
    }
    return { participantes, avisosAptidao, impedimentos };
  }, { timeout: timeoutTransacaoAnimais(animaisIds.length) });
  const previa = await preverParticipacaoIndividual({ ...calendario, pagina: 1, porPagina: 10, tipo: "REPRODUTIVO", animalId: animaisIds[0] });
  const procedimentos = [...previa.itens];
  for (let pagina = 2; procedimentos.length < previa.total; pagina++) {
    const proxima = await preverParticipacaoIndividual({ ...calendario, pagina, porPagina: 10, tipo: "REPRODUTIVO", animalId: animaisIds[0] });
    if (!proxima.itens.length) throw new RebanhoError("CONFLITO", "Não foi possível carregar todo o calendário da versão.");
    procedimentos.push(...proxima.itens);
  }
  const automaticas = await preverAutomacoesAdesao({ propriedadeId: input.propriedadeId, protocoloId: input.protocoloId, animais: [{animalId: animaisIds[0], inicioPrevisto: input.inicioReferencia}] });
  const estrutura = await transacaoPecuaria(async tx => {
    const etapas = await tx.etapaProtocolo.findMany({ where: { protocoloId: input.protocoloId }, orderBy: [{ ordem: "asc" }, { id: "asc" }], include: { momento: true, produto: { select: { id: true, nome: true, unidade: true } }, material: { select: { produto: { select: { id: true, nome: true, unidade: true } } } } } });
    const saldos = new Map<string, Prisma.Decimal>();
    for (const etapa of etapas) {
      const produto = etapa.produto ?? etapa.material?.produto;
      if (produto && !saldos.has(produto.id)) saldos.set(produto.id, await obterSaldo(tx, produto.id, input.propriedadeId));
    }
    return { etapas, saldos };
  });
  const procedimentosComAutomacao = procedimentos.map(procedimento => {
    const automatica = automaticas.itens.find(a => a.etapaId === procedimento.id);
    return automatica ? { ...procedimento, previstaPara: automatica.programadaPara, precisaoTemporal: "HORA" as const } : procedimento;
  });
  const grupos = new Map<string, { id: string; nome: string; legado: boolean; procedimentos: typeof procedimentos }>();
  for (const procedimento of procedimentosComAutomacao) {
    const etapa = estrutura.etapas.find(e => e.id === procedimento.id);
    const chave = etapa?.momentoId ?? procedimento.id;
    const grupo = grupos.get(chave) ?? { id: chave, nome: etapa?.momento?.nome ?? procedimento.nome, legado: !etapa?.momentoId, procedimentos: [] };
    grupo.procedimentos.push(procedimento);
    grupos.set(chave, grupo);
  }
  const todos = [...grupos.values()];
  const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(todos.length / input.porPagina)));
  const insumos = new Map<string, { produtoId: string; produto: string; unidade: string; quantidade: Prisma.Decimal; saldo: Prisma.Decimal | null; incompatível: boolean }>();
  const pendentes: string[] = [];
  for (const etapa of estrutura.etapas) {
    if (etapa.tipo !== "APLICACAO" && etapa.tipo !== "TENTATIVA") continue;
    const config = etapa.configuracao as Record<string, unknown>;
    const plano = (etapa.tipo === "APLICACAO" ? config.planoAplicacao : config.planoTentativa) as Record<string, unknown> | undefined;
    if (etapa.tipo === "TENTATIVA" && (config.tentativaTipo === "COBERTURA" || plano?.tipo === "COBERTURA")) continue;
    const produto = etapa.produto ?? etapa.material?.produto;
    const quantidade = etapa.tipo === "APLICACAO" ? plano?.dose ?? etapa.dose?.toString() : plano?.quantidade;
    const unidade = etapa.tipo === "APLICACAO" ? plano?.unidadeDose ?? etapa.unidade : produto?.unidade;
    if (!produto || quantidade == null || !unidade || !(String(unidade) in UNIDADES)) { pendentes.push(etapa.nome); continue; }
    let valor: Prisma.Decimal;
    try { valor = converterQuantidade(new Prisma.Decimal(String(quantidade)), unidade as UnidadeMedida, produto.unidade).mul(animaisIds.length); }
    catch { pendentes.push(`${etapa.nome} · unidade incompatível`); continue; }
    const atual = insumos.get(produto.id) ?? { produtoId: produto.id, produto: produto.nome, unidade: produto.unidade, quantidade: new Prisma.Decimal(0), saldo: estrutura.saldos.get(produto.id) ?? null, incompatível: false };
    atual.quantidade = atual.quantidade.plus(valor); insumos.set(produto.id, atual);
  }
  const paginaLegada = Math.min(input.pagina, Math.max(1, Math.ceil(previa.total / input.porPagina)));
  return { dataReferenciaContexto: referencia.toISOString().slice(0, 10), protocolo: {nome:previa.protocolo.nome,versao:previa.protocolo.versao}, itens: procedimentosComAutomacao.slice((paginaLegada - 1) * input.porPagina, paginaLegada * input.porPagina), grupos: todos.slice((pagina - 1) * input.porPagina, pagina * input.porPagina), todosGrupos: todos, totalGrupos: todos.length, paginaGrupos: pagina, total: previa.total, pagina: paginaLegada, porPagina: input.porPagina, participantes, avisosAptidao, impedimentos,
    consumoPrevisto: { itens: [...insumos.values()].map(i => ({ produtoId: i.produtoId, produto: i.produto, unidade: i.unidade, quantidade: i.quantidade.toString(), saldo: i.saldo?.toString() ?? null, falta: i.saldo == null ? null : Prisma.Decimal.max(i.quantidade.minus(i.saldo), 0).toString() })), pendentes }, avisos: [] };
}
