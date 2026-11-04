import { z } from "zod";
import { revisaoRetroativaSchema } from "./automacao.schemas.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { transacaoPecuaria } from "../transacao.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { podeVerValoresFinanceiros } from "../custos/permissoes.js";
import { temArea, temPermissao } from "../../auth/papeis.js";
import { aplicacaoProtocoloSchema, type ItemExecucaoProtocolo } from "./execucao.schemas.js";
import { retiradaProtocoloSchema } from "./execucao.manejos.schemas.js";
import { prepararExecucaoProtocoloTx, executarItensPreparadosProtocoloTx } from "./execucao.js";
import { diaIatf } from "../reproducao/horarios.calc.js";
import { instanteProgramado, validarDataAutomacao } from "./automacao.calc.js";
import { anularAplicacaoTx } from "../sanidade/aplicacoes.js";
import { anularManejoProtocolarTx } from "./manejos-correcao.js";
import { efeitosAplicacao } from "./automacao-efeitos.calc.js";
import { exigirPeriodoAberto, FinanceiroError } from "../../financeiro/regras.js";
import { operacaoIdempotenteTx, hashDados } from "../reproducao/operacoes.js";

type Tx = Prisma.TransactionClient;
const retiradaAutomaticaSchema = retiradaProtocoloSchema.omit({ insercaoAplicacaoId: true }).extend({ insercaoAplicacaoId: z.string().uuid().optional(), insercaoTarefaId: z.string().uuid().optional() }).strict().refine(i => Boolean(i.insercaoAplicacaoId) !== Boolean(i.insercaoTarefaId), "Informe a inserção realizada ou a ação de inserção programada");
const itemAutomaticoSchema = z.union([aplicacaoProtocoloSchema, retiradaAutomaticaSchema]);
export const ativarAutomacaoSchema = z.object({
  propriedadeId: z.number().int().positive(), participacaoId: z.string().uuid(), momentoId: z.string().uuid(),
  itens: z.array(itemAutomaticoSchema).min(1).max(30),
}).strict();
type Entrada = z.infer<typeof ativarAutomacaoSchema>;
const politicaSchema = z.object({ id: z.string(), politicaExecucao: z.literal("AUTOMATICA_EXCECAO"), horarioPadrao: z.string(), fusoHorario: z.literal("America/Sao_Paulo") });
function json(v: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue; }

async function autorizarTx(tx: Tx, usuarioId: number) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.status !== "ATIVO" || !temArea(usuario, "pecuaria") || !temPermissao(usuario, "lancar")) throw new RebanhoError("VALIDACAO", "O responsável pela automação não possui acesso ativo para lançar em Pecuária");
  return usuario;
}
async function contextoTx(tx: Tx, input: Entrada) {
  const participacao = await tx.participacaoProtocolo.findFirst({ where: { id: input.participacaoId, propriedadeId: input.propriedadeId }, include: { rodada: true, protocolo: true } });
  if (!participacao || participacao.protocolo.tipo !== "REPRODUTIVO") throw new RebanhoError("NAO_ENCONTRADO", "Participação reprodutiva não encontrada neste sítio");
  await travarAnimais(tx, [participacao.animalId]);
  if (participacao.canceladaEm || (participacao.rodada && participacao.rodada.status !== "ABERTA")) throw new RebanhoError("CONFLITO", "Participação encerrada");
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucaoId: participacao.id }, include: { etapa: true }, orderBy: { etapa: { ordem: "asc" } } });
  const selecionadas = tarefas.filter(t => { const m = t.momentoSnapshot as Record<string, unknown> | null; return m?.id === input.momentoId; });
  if (!selecionadas.length || selecionadas.length !== input.itens.length || new Set(input.itens.map(i => i.tarefaId)).size !== input.itens.length) throw new RebanhoError("VALIDACAO", "Informe todas as ações do momento para este animal");
  const datas = new Set<number>();
  for (const tarefa of selecionadas) {
    const item = input.itens.find(i => i.tarefaId === tarefa.id);
    if (!item || item.animalId !== participacao.animalId || item.propriedadeId !== input.propriedadeId) throw new RebanhoError("VALIDACAO", "Ação não pertence a este momento, animal e sítio");
    if (tarefa.realizadaEm || tarefa.dispensadaEm || tarefa.regularizacaoPendente || tarefa.previsaoPendente || (Array.isArray(tarefa.historicoRegularizacao) && tarefa.historicoRegularizacao.some(h => h && typeof h === "object" && !Array.isArray(h) && h.acao === "REVISAO_AUTOMACAO_RETROATIVA"))) throw new RebanhoError("CONFLITO", "Ação realizada, dispensada ou pendente de revisão não pode ser automatizada");
    const politica = politicaSchema.safeParse(tarefa.momentoSnapshot);
    if (!politica.success) throw new RebanhoError("VALIDACAO", "A etapa exige confirmação; o modo automatizado legado não autoriza execução agendada");
    if (tarefa.etapa.tipo !== item.tipo || !["APLICACAO", "RETIRADA"].includes(tarefa.etapa.tipo)) throw new RebanhoError("VALIDACAO", "Somente aplicações e retiradas de dispositivo podem ser automatizadas");
    const instante = tarefa.precisaoTemporal === "HORA" ? tarefa.previstaPara : instanteProgramado(tarefa.previstaPara.toISOString().slice(0, 10), politica.data.horarioPadrao, politica.data.fusoHorario);
    datas.add(instante.getTime());
  }
  if (datas.size !== 1) throw new RebanhoError("VALIDACAO", "As ações do momento devem possuir a mesma data e horário");
  return { participacao, tarefas: selecionadas, programadaPara: new Date([...datas][0]) };
}
async function resolverItemTx(tx: Tx, item: Entrada["itens"][number], participacaoId: string, planejamento: boolean): Promise<ItemExecucaoProtocolo | null> {
  if (item.tipo !== "RETIRADA" || !item.insercaoTarefaId) return itemAutomaticoSemReferencia(item);
  const origem = await tx.tarefaProtocolo.findFirst({ where: { id: item.insercaoTarefaId, execucaoId: participacaoId }, include: { etapa: true, aplicacoes: { where: { status: "VALIDO" } } } });
  const destino = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: item.tarefaId } });
  const config = origem?.etapa.configuracao as Record<string, unknown> | null;
  if (!origem || config?.subtipo !== "INSERCAO_DISPOSITIVO" || origem.dispensadaEm || origem.regularizacaoPendente || origem.previstaPara >= destino.previstaPara) throw new RebanhoError("VALIDACAO", "A retirada deve referenciar uma inserção anterior deste protocolo");
  if (!origem.aplicacoes.length && planejamento) {
    const autorizada = await tx.automacaoProtocolo.findFirst({ where: { participacaoId, momentoId: (origem.momentoSnapshot as Record<string, string>)?.id, estado: "AGENDADA" } });
    const revisaoManual = Array.isArray(origem.historicoRegularizacao) && origem.historicoRegularizacao.some(h => h && typeof h === "object" && !Array.isArray(h) && h.acao === "REVISAO_AUTOMACAO_RETROATIVA" && h.decisao === "REGISTRAR_MANUALMENTE");
    if (!autorizada && !revisaoManual) throw new RebanhoError("VALIDACAO", "Autorize primeiro a etapa de inserção do dispositivo");
    return null; // A origem física só pode ser conferida após a inserção ocorrer.
  }
  if (origem.aplicacoes.length !== 1) throw new RebanhoError("CONFLITO", "A inserção programada ainda não possui um único registro válido");
  const { insercaoTarefaId: _, ...dados } = item;
  return retiradaProtocoloSchema.parse({ ...dados, insercaoAplicacaoId: origem.aplicacoes[0].id });
}
function itemAutomaticoSemReferencia(item: Entrada["itens"][number]): ItemExecucaoProtocolo {
  if (item.tipo === "APLICACAO") return item;
  const { insercaoTarefaId: _, ...dados } = item;
  return retiradaProtocoloSchema.parse(dados);
}

function comInstante(item: ItemExecucaoProtocolo, instante: Date, _data: string): ItemExecucaoProtocolo {
  const data = diaIatf(instante);
  return item.tipo === "APLICACAO" ? { ...item, data, aplicadaEm: instante.toISOString() } : { ...item, data, realizadaEm: instante.toISOString() } as ItemExecucaoProtocolo;
}

/** Integrar na transação de início: nenhum job é criado se algum animal falhar. */
export async function ativarAutomacaoTx(tx: Tx, entrada: unknown, usuarioId: number, agora = new Date()) {
  const input = ativarAutomacaoSchema.parse(entrada);
  await autorizarTx(tx, usuarioId);
  const contexto = await contextoTx(tx, input);
  validarDataAutomacao(contexto.programadaPara, agora);
  const anterior = await tx.automacaoProtocolo.findUnique({ where: { participacaoId_momentoId: { participacaoId: input.participacaoId, momentoId: input.momentoId } } });
  if (anterior) throw new RebanhoError("CONFLITO", "Esta etapa já possui automação; revise a programação existente");
  // Valida dados/origens/carências já na autorização. Nenhuma ciência é inventada.
  for (const tarefa of contexto.tarefas) {
    const item = await resolverItemTx(tx, input.itens.find(i => i.tarefaId === tarefa.id)!, input.participacaoId, true);
    if (!item) continue;
    await prepararExecucaoProtocoloTx(tx, { versao: 1, propriedadeId: input.propriedadeId, itens: [comInstante(item, contexto.programadaPara, tarefa.previstaPara.toISOString().slice(0, 10))] }, { planejamentoFuturo: true });
  }
  const job = await tx.automacaoProtocolo.create({ data: { participacaoId: input.participacaoId, momentoId: input.momentoId, propriedadeId: input.propriedadeId, usuarioId, programadaPara: contexto.programadaPara, configuracao: json(input) } });
  await auditar(tx, { entidade: "AutomacaoProtocolo", entidadeId: job.id, animalId: contexto.participacao.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: "AUTORIZACAO_AUTOMACAO", depois: job });
  return job;
}
export function ativarAutomacao(entrada: unknown, usuarioId: number) { return transacaoPecuaria(tx => ativarAutomacaoTx(tx, entrada, usuarioId)); }
export async function listarAutomacoes(propriedadeId: number, filtro: { participacaoId?: string; programacaoId?: string }) {
  if (!filtro.participacaoId && !filtro.programacaoId) throw new RebanhoError("VALIDACAO", "Informe a participação ou programação");
  const jobs = await prisma.automacaoProtocolo.findMany({ where: { propriedadeId, ...(filtro.participacaoId ? { participacaoId: filtro.participacaoId } : {}), ...(filtro.programacaoId ? { participacao: { rodadaId: filtro.programacaoId } } : {}) }, select: { id: true, participacaoId: true, momentoId: true, estado: true, programadaPara: true, executadaEm: true, tentativas: true, erro: true, resultado: true, configuracao: true, momento: { select: { id: true, nome: true } }, participacao: { select: { animal: { select: { id: true, nome: true, brinco: true } }, tarefas: { select: { id: true, momentoSnapshot: true, nomeSnapshot: true, historicoRegularizacao: true, aplicacoes: { where: { status: "VALIDO" }, select: { id: true } }, etapa: { select: { nome: true, tipo: true } } } } } } }, orderBy: { programadaPara: "asc" } });
  const fatos = jobs.flatMap(job => Array.isArray(job.resultado) ? job.resultado : []).filter((v): v is Prisma.JsonObject => Boolean(v && typeof v === "object" && !Array.isArray(v)));
  const [aplicacoes, manejos] = await Promise.all([
    prisma.aplicacaoProduto.findMany({ where: { propriedadeId, id: { in: fatos.filter(f => f.tipo === "APLICACAO").map(f => String(f.id)) } }, select: { id: true, status: true } }),
    prisma.manejoAnimal.findMany({ where: { propriedadeId, id: { in: fatos.filter(f => f.tipo === "RETIRADA").map(f => String(f.id)) } }, select: { id: true, status: true } }),
  ]);
  const estados = new Map([...aplicacoes, ...manejos].map(f => [f.id, f.status]));
  return jobs.map(({ participacao, configuracao, ...job }) => ({ ...job, dependenciasPendentes: ativarAutomacaoSchema.parse(configuracao).itens.flatMap(item => {
    if (item.tipo !== "RETIRADA" || !item.insercaoTarefaId || job.estado === "CANCELADA" || job.executadaEm) return [];
    const origem = participacao.tarefas.find(t => t.id === item.insercaoTarefaId);
    return origem && !origem.aplicacoes.length && Array.isArray(origem.historicoRegularizacao) && origem.historicoRegularizacao.some(h => h && typeof h === "object" && !Array.isArray(h) && h.acao === "REVISAO_AUTOMACAO_RETROATIVA" && h.decisao === "REGISTRAR_MANUALMENTE") ? [{ tarefaId: origem.id, nome: origem.nomeSnapshot ?? origem.etapa.nome, tipo: "INSERCAO_MANUAL_PENDENTE" as const }] : [];
  }), resultado: Array.isArray(job.resultado) ? job.resultado.map(f => f && typeof f === "object" && !Array.isArray(f) ? { ...f, statusFato: estados.get(String(f.id)) ?? null } : f) : job.resultado, animal: participacao.animal, procedimentos: participacao.tarefas.filter(t => (t.momentoSnapshot as Record<string, unknown> | null)?.id === job.momentoId).map(t => ({ tarefaId: t.id, nome: t.nomeSnapshot ?? t.etapa.nome, tipo: t.etapa.tipo })) }));
}

/** Uma transação por momento/animal, com recibo e efeitos indivisíveis.
 * A trava vive só durante a transação: queda do Worker faz rollback, sem lease órfão. */
export async function executarAutomacaoTx(tx: Tx, id: string, agora: Date) {
  const ref = await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id }, include: { participacao: true } });
  await travarAnimais(tx, [ref.participacao.animalId]);
  await tx.$queryRaw`SELECT id FROM pecuaria."AutomacaoProtocolo" WHERE id = ${id} FOR UPDATE`;
  const job = await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id } });
  if (job.estado !== "AGENDADA" || job.programadaPara > agora) return { id, estado: job.estado };
  await autorizarTx(tx, job.usuarioId);
  const input = ativarAutomacaoSchema.parse(job.configuracao);
  const contexto = await contextoTx(tx, input);
  if (contexto.programadaPara.getTime() !== job.programadaPara.getTime()) throw new RebanhoError("CONFLITO", "Calendário alterado: revise a autorização da automação");
  const resultado = [];
  for (const tarefa of contexto.tarefas) {
    const item = await resolverItemTx(tx, input.itens.find(i => i.tarefaId === tarefa.id)!, input.participacaoId, false);
    if (!item) throw new RebanhoError("CONFLITO", "Inserção não executada");
    const previa = await prepararExecucaoProtocoloTx(tx, { versao: 1, propriedadeId: job.propriedadeId, itens: [comInstante(item, job.programadaPara, tarefa.previstaPara.toISOString().slice(0, 10))] });
    resultado.push(...await executarItensPreparadosProtocoloTx(tx, previa, job.usuarioId));
    const atual = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: tarefa.id }, select: { realizadoSnapshot: true } });
    await tx.tarefaProtocolo.update({ where: { id: tarefa.id }, data: { realizadoSnapshot: json({ ...(atual.realizadoSnapshot as Record<string, unknown> | null), origemExecucao: "AUTOMATICA_PROGRAMADA", automacaoId: job.id, programadaPara: job.programadaPara.toISOString(), processadaEm: agora.toISOString() }) } });
  }
  const salva = await tx.automacaoProtocolo.update({ where: { id }, data: { estado: "EXECUTADA", executadaEm: agora, resultado: json(resultado), erro: null, tentativas: { increment: 1 } } });
  await auditar(tx, { entidade: "AutomacaoProtocolo", entidadeId: id, animalId: contexto.participacao.animalId, propriedadeId: job.propriedadeId, usuarioId: job.usuarioId, acao: "EXECUCAO_AUTOMATICA", depois: { programadaPara: job.programadaPara, processadaEm: agora, resultado } });
  return { id: salva.id, estado: salva.estado };
}
export async function processarAutomacoes(agora = new Date()) {
  const jobs = await prisma.automacaoProtocolo.findMany({ where: { estado: "AGENDADA", programadaPara: { lte: agora } }, orderBy: { programadaPara: "asc" }, take: 50, select: { id: true, atualizadaEm: true, tentativas: true, revisao: true } });
  const resultados = [];
  for (const job of jobs) {
    try { resultados.push(await transacaoPecuaria(tx => executarAutomacaoTx(tx, job.id, agora))); }
    catch (erro) {
      // Nunca desfaz uma execução/cancelamento que outro Worker já confirmou.
      const transitoria = erro instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1008", "P1017", "P2024", "P2028", "P2034"].includes(erro.code);
      const estado = transitoria && job.tentativas < 4 ? "AGENDADA" : "FALHOU";
      // CAS da revisão lida: uma falha antiga jamais sobrescreve correção concorrente.
      const atualizada = await prisma.automacaoProtocolo.updateMany({ where: { id: job.id, estado: "AGENDADA", revisao: job.revisao, atualizadaEm: job.atualizadaEm }, data: { estado, erro: erro instanceof RebanhoError ? erro.message : "Falha no processamento. " + (estado === "AGENDADA" ? "Nova tentativa automática no próximo ciclo." : "Revise os dados antes de tentar novamente."), tentativas: { increment: 1 } } });
      resultados.push({ id: job.id, estado: atualizada.count ? estado : "REVISAO_CONCORRENTE" });
    }
  }
  return resultados;
}

export const revisarAutomacaoSchema = ativarAutomacaoSchema.extend({ motivo: z.string().trim().min(5).max(1000) }).strict();
export async function revisarAutomacao(id: string, entrada: unknown, usuarioId: number) {
  const { motivo, ...input } = revisarAutomacaoSchema.parse(entrada);
  return transacaoPecuaria(async tx => {
    const ator = await autorizarTx(tx, usuarioId);
    const contexto = await contextoTx(tx, input);
    await tx.$queryRaw`SELECT id FROM pecuaria."AutomacaoProtocolo" WHERE id = ${id} FOR UPDATE`;
    const antes = await tx.automacaoProtocolo.findFirst({ where: { id, propriedadeId: input.propriedadeId, participacaoId: input.participacaoId, momentoId: input.momentoId } });
    if (!antes || !["AGENDADA", "FALHOU"].includes(antes.estado)) throw new RebanhoError("CONFLITO", "Automação executada ou encerrada não pode ser reativada");
    if (!podeVerValoresFinanceiros(ator)) {
      const anterior = ativarAutomacaoSchema.parse(antes.configuracao);
      input.itens = input.itens.map(item => {
        const origem = anterior.itens.find(i => i.tarefaId === item.tarefaId);
        if (origem?.tipo === "RETIRADA" && item.tipo === "RETIRADA") return { ...item, valorServicoAtribuido: origem.valorServicoAtribuido };
        return item;
      });
    }
    if (contexto.programadaPara.getTime() !== antes.programadaPara.getTime()) validarDataAutomacao(contexto.programadaPara, new Date());
    for (const tarefa of contexto.tarefas) {
      const item = await resolverItemTx(tx, input.itens.find(i => i.tarefaId === tarefa.id)!, input.participacaoId, true);
      if (item) await prepararExecucaoProtocoloTx(tx, { versao: 1, propriedadeId: input.propriedadeId, itens: [comInstante(item, contexto.programadaPara, tarefa.previstaPara.toISOString().slice(0, 10))] }, { planejamentoFuturo: true });
    }
    const depois = await tx.automacaoProtocolo.update({ where: { id }, data: { estado: "AGENDADA", configuracao: json(input), programadaPara: contexto.programadaPara, usuarioId, erro: null, revisao: { increment: 1 }, tentativas: 0 } });
    await auditar(tx, { entidade: "AutomacaoProtocolo", entidadeId: id, propriedadeId: input.propriedadeId, animalId: contexto.participacao.animalId, usuarioId, acao: "REVISAO_AUTOMACAO", antes, depois: { ...depois, motivo } });
    return depois;
  });
}

/** Retirar da programação não equivale à retirada física de um dispositivo. */
export async function conferirDispositivoAntesRetiradaTx(tx: Tx, participacaoId: string) {
  const aplicacoes = await tx.aplicacaoProduto.findMany({ where: { tarefa: { execucaoId: participacaoId }, OR: [{ status: "VALIDO" }, { status: "ANULADO", consumoMantido: true, OR: [{ administracaoMantida: true }, { administracaoMantida: null }] }] }, include: { tarefa: { include: { etapa: true } }, retiradasDispositivo: { where: { OR: [{ status: "VALIDO" }, { realizacaoMantida: true }] } } } });
  if (aplicacoes.some(a => !a.retiradasDispositivo.length && (a.insercaoDispositivoSnapshot || (a.tarefa?.etapa.configuracao as Record<string, unknown> | null)?.subtipo === "INSERCAO_DISPOSITIVO"))) throw new RebanhoError("VALIDACAO", "Há dispositivo inserido ou com administração não esclarecida. Registre sua retirada física ou regularize a inserção antes de retirar o animal do protocolo", "retirarDoProtocolo");
}

export const excecaoAutomacaoSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  chave: z.string().uuid(), propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000), retirarDoProtocolo: z.boolean(),
  reversoes: z.array(z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("APLICACAO"), id: z.string().uuid(), destinoConsumo: z.enum(["DEVOLVER_ESTOQUE", "MANTER_CONSUMO"]), administracaoMantida: z.boolean().nullable().optional() }).strict(),
    z.object({ tipo: z.literal("RETIRADA"), id: z.string().uuid(), realizacaoMantida: z.boolean(), cienciaNaoExecutado: z.boolean().optional() }).strict(),
  ])).default([]),
}).strict();
/** Lê o mesmo conjunto da confirmação; não cria fatos, estornos nem reservas. */
export async function prepararPreviaExcecaoAutomacaoTx(tx: Tx, id: string, entrada: unknown, usuarioId: number) {
  const { fingerprint: _fingerprint, ...input } = excecaoAutomacaoSchema.parse(entrada);
  await autorizarTx(tx, usuarioId);
  const job = await tx.automacaoProtocolo.findFirst({ where: { id, propriedadeId: input.propriedadeId }, include: { participacao: true } });
  if (!job) throw new RebanhoError("NAO_ENCONTRADO", "Automação não encontrada neste sítio");
  const recibo = z.array(z.object({ id: z.string(), tipo: z.string() })).parse(job.resultado ?? []);
  if (new Set(input.reversoes.map(r => r.id)).size !== input.reversoes.length || input.reversoes.some(r => !recibo.some(f => f.id === r.id && f.tipo === r.tipo))) throw new RebanhoError("VALIDACAO", "A reversão deve corresponder a fatos desta automação");
  const aplicacoes = await tx.aplicacaoProduto.findMany({ where: { id: { in: recibo.filter(f => f.tipo === "APLICACAO").map(f => f.id) }, propriedadeId: input.propriedadeId }, orderBy: { id: "asc" }, include: { tarefa: { select: { nomeSnapshot: true, etapa: { select: { nome: true } } } } } });
  const manejos = await tx.manejoAnimal.findMany({ where: { id: { in: recibo.filter(f => f.tipo === "RETIRADA").map(f => f.id) }, propriedadeId: input.propriedadeId }, orderBy: { id: "asc" }, include: { tarefa: { select: { nomeSnapshot: true, etapa: { select: { nome: true } } } } } });
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucaoId: job.participacaoId, realizadaEm: null, dispensadaEm: null }, select: { id: true, nomeSnapshot: true, previstaPara: true, etapa: { select: { nome: true } } }, orderBy: [{ previstaPara: "asc" }, { id: "asc" }] });
  const insercoes = await tx.aplicacaoProduto.findMany({ where: { tarefa: { execucaoId: job.participacaoId }, OR: [{ status: "VALIDO" }, { status: "ANULADO", consumoMantido: true, OR: [{ administracaoMantida: true }, { administracaoMantida: null }] }] }, orderBy: { id: "asc" }, include: { tarefa: { include: { etapa: true } }, retiradasDispositivo: { orderBy: { id: "asc" }, where: { OR: [{ status: "VALIDO" }, { realizacaoMantida: true }] } } } });
  const dispositivosPendentes = insercoes.filter(a => {
    if (!a.insercaoDispositivoSnapshot && (a.tarefa?.etapa.configuracao as Record<string, unknown> | null)?.subtipo !== "INSERCAO_DISPOSITIVO") return false;
    const reversao = input.reversoes.find(r => r.id === a.id);
    if (reversao?.tipo === "APLICACAO" && (reversao.destinoConsumo === "DEVOLVER_ESTOQUE" || reversao.administracaoMantida === false)) return false;
    return !a.retiradasDispositivo.some(r => { const reversa = input.reversoes.find(i => i.id === r.id); return !reversa || reversa.tipo !== "RETIRADA" || reversa.realizacaoMantida; });
  }).map(a => ({ insercaoId: a.id, produto: a.nomeProdutoAplicado }));
  const impedimentos: string[] = [];
  if (job.estado === "CANCELADA") impedimentos.push("Esta automação já foi encerrada.");
  if (job.executadaEm && !input.reversoes.length && !input.retirarDoProtocolo) impedimentos.push("Selecione os registros a reverter ou a retirada da participação.");
  if (input.retirarDoProtocolo && dispositivosPendentes.length) impedimentos.push("Há dispositivo inserido ou administração não esclarecida. Registre a retirada física ou regularize a inserção antes de encerrar a participação.");
  for (const reversao of input.reversoes) {
    const fato = reversao.tipo === "APLICACAO" ? aplicacoes.find(a => a.id === reversao.id) : manejos.find(m => m.id === reversao.id);
    if (!fato || fato.status !== "VALIDO") { impedimentos.push("Um registro selecionado já foi anulado ou não está disponível neste sítio."); continue; }
    if (reversao.tipo === "APLICACAO" && reversao.destinoConsumo === "DEVOLVER_ESTOQUE" && reversao.administracaoMantida != null) impedimentos.push("Devolução exige material não utilizado; não mantenha administração.");
    if (reversao.tipo === "APLICACAO" && (reversao.destinoConsumo === "DEVOLVER_ESTOQUE" || reversao.administracaoMantida === false)) {
      const insercao = insercoes.find(a => a.id === reversao.id);
      if (insercao?.retiradasDispositivo.some(r => { const reversa = input.reversoes.find(i => i.id === r.id); return !reversa || reversa.tipo !== "RETIRADA" || reversa.realizacaoMantida; })) impedimentos.push("A inserção possui retirada física mantida. Regularize a retirada antes de declarar que a inserção não ocorreu.");
    }
    if (reversao.tipo === "RETIRADA" && !reversao.realizacaoMantida && !reversao.cienciaNaoExecutado) impedimentos.push("Confirme que a retirada física não aconteceu.");
    if (fato.operacaoServicoId || "movimentoEstoqueId" in fato && (fato.movimentoEstoqueId || fato.itemCompraDiretaId)) {
      try { await exigirPeriodoAberto(tx, input.propriedadeId, fato.data); }
      catch (erro) { if (!(erro instanceof FinanceiroError) || erro.code !== "PERIODO_FECHADO") throw erro; impedimentos.push("O período financeiro do registro está fechado; a reversão exige regularização do período."); }
    }
  }
  const fatos = [
    ...aplicacoes.filter(a => a.status === "VALIDO").map(a => { const r = input.reversoes.find(i => i.id === a.id); return { id: a.id, tipo: "APLICACAO", nome: a.tarefa?.nomeSnapshot ?? a.tarefa?.etapa.nome ?? a.nomeProdutoAplicado, selecionado: !!r, ...efeitosAplicacao({ reverter: !!r, possuiMovimentoEstoque: !!a.movimentoEstoqueId, ...(r?.tipo === "APLICACAO" ? r : {}) }) }; }),
    ...manejos.filter(m => m.status === "VALIDO").map(m => { const r = input.reversoes.find(i => i.id === m.id); const mantida = !r || r.tipo === "RETIRADA" && r.realizacaoMantida; return { id: m.id, tipo: "RETIRADA", nome: m.tarefa?.nomeSnapshot ?? m.tarefa?.etapa.nome ?? "Retirada de dispositivo", selecionado: !!r, efeitoMaterial: "Nenhuma entrada de material no estoque.", efeitoAdministracao: mantida ? "Retirada física preservada." : "Retirada física não mantida; a inserção volta a exigir cuidado.", efeitoCarencia: "A inserção e suas carências não são apagadas pela alteração da retirada.", efeitoCustos: mantida ? "Custo do atendimento preservado." : "Registro anulado sem apagar o Serviço contratado ou o histórico." }; }),
  ];
  const configuracao = ativarAutomacaoSchema.parse(job.configuracao);
  const canceladas = tarefas.filter(t => input.retirarDoProtocolo || configuracao.itens.some(i => i.tarefaId === t.id));
  const resumo = { fatos, participacao: { efeito: input.retirarDoProtocolo ? "ENCERRAR" as const : "MANTER" as const, tarefasCanceladas: canceladas.map(t => ({ id: t.id, nome: t.nomeSnapshot ?? t.etapa.nome, previstaPara: t.previstaPara.toISOString() })) }, dispositivosPendentes, impedimentos };
  // Datas, estados, parâmetros e escolhas participam da conferência. O hash não expõe valores.
  return { ...resumo, fingerprint: hashDados({ input, job, aplicacoes, manejos, tarefas, insercoes, resumo }) };
}
export function preverExcecaoAutomacao(id: string, entrada: unknown, usuarioId: number) {
  return prisma.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return prepararPreviaExcecaoAutomacaoTx(tx, id, entrada, usuarioId); }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export function registrarExcecaoAutomacao(id: string, entrada: unknown, usuarioId: number) {
  return transacaoPecuaria(tx => registrarExcecaoAutomacaoTx(tx, id, entrada, usuarioId));
}
export async function registrarExcecaoAutomacaoTx(tx: Tx, id: string, entrada: unknown, usuarioId: number) {
  const input = excecaoAutomacaoSchema.parse(entrada);
    await autorizarTx(tx, usuarioId);
    const ref = await tx.automacaoProtocolo.findFirst({ where: { id, propriedadeId: input.propriedadeId }, include: { participacao: true } });
    if (!ref) throw new RebanhoError("NAO_ENCONTRADO", "Automação não encontrada neste sítio");
    await travarAnimais(tx, [ref.participacao.animalId]);
    return operacaoIdempotenteTx(tx, { ...input, automacaoId: id }, usuarioId, "EXCECAO_AUTOMACAO", async () => {
      await tx.$queryRaw`SELECT id FROM pecuaria."AutomacaoProtocolo" WHERE id = ${id} FOR UPDATE`;
      const job = await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id } });
      if (job.estado === "CANCELADA") throw new RebanhoError("CONFLITO", "Esta automação já foi encerrada");
      const fatos = z.array(z.object({ id: z.string(), tipo: z.string() })).parse(job.resultado ?? []);
      if (input.retirarDoProtocolo && !input.reversoes.length && ref.participacao.canceladaEm) return { id, estado: job.estado, participacaoRetirada: true };
      const previa = await prepararPreviaExcecaoAutomacaoTx(tx, id, input, usuarioId);
      if (input.fingerprint && previa.fingerprint !== input.fingerprint) throw new RebanhoError("CONFLITO", "Os dados ou efeitos mudaram; confira uma nova prévia antes de confirmar", "fingerprint");
      if (previa.impedimentos.length) throw new RebanhoError("VALIDACAO", previa.impedimentos.join(" "));
      if (job.executadaEm && !input.reversoes.length && !input.retirarDoProtocolo) throw new RebanhoError("VALIDACAO", "Informe quais registros precisam ser revertidos");
      if (new Set(input.reversoes.map(r => r.id)).size !== input.reversoes.length || input.reversoes.some(r => !fatos.some(f => f.id === r.id && f.tipo === r.tipo))) throw new RebanhoError("VALIDACAO", "A reversão deve corresponder a fatos desta automação");
      for (const reversao of input.reversoes) {
        if (reversao.tipo === "APLICACAO") await anularAplicacaoTx(tx, reversao.id, input.propriedadeId, input.motivo, usuarioId, reversao.destinoConsumo, reversao.administracaoMantida);
        else await anularManejoProtocolarTx(tx, reversao.id, { chave: input.chave, propriedadeId: input.propriedadeId, motivo: input.motivo, realizacaoMantida: reversao.realizacaoMantida, cienciaNaoExecutado: reversao.cienciaNaoExecutado }, usuarioId);
      }
      const configuracao = ativarAutomacaoSchema.parse(job.configuracao);
      await tx.tarefaProtocolo.updateMany({ where: { id: { in: configuracao.itens.map(i => i.tarefaId) }, realizadaEm: null, dispensadaEm: null }, data: { dispensadaEm: new Date(), motivoDispensa: input.motivo } });
      if (input.retirarDoProtocolo) {
        await conferirDispositivoAntesRetiradaTx(tx, job.participacaoId);
        await tx.participacaoProtocolo.update({ where: { id: job.participacaoId }, data: { canceladaEm: new Date(), motivoCancelamento: input.motivo } });
        await tx.tarefaProtocolo.updateMany({ where: { execucaoId: job.participacaoId, realizadaEm: null, dispensadaEm: null }, data: { dispensadaEm: new Date(), motivoDispensa: input.motivo } });
        await tx.automacaoProtocolo.updateMany({ where: { participacaoId: job.participacaoId, estado: { in: ["AGENDADA", "FALHOU"] } }, data: { estado: "CANCELADA", erro: input.motivo } });
      }
      const salva = await tx.automacaoProtocolo.update({ where: { id }, data: { estado: job.executadaEm ? (input.reversoes.length ? "REVERTIDA" : job.estado) : "CANCELADA", erro: input.motivo } });
      await auditar(tx, { entidade: "AutomacaoProtocolo", entidadeId: id, animalId: ref.participacao.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: "EXCECAO_AUTOMACAO", antes: job, depois: { ...salva, reversoes: input.reversoes, retirarDoProtocolo: input.retirarDoProtocolo } });
      return { id, estado: salva.estado, participacaoRetirada: input.retirarDoProtocolo };
    });
}

export async function ativarAutomacoesAdesaoTx(tx: Tx, participacaoId: string, propriedadeId: number, entradas: Array<{ animalId: string; etapaId: string; dados: Record<string, unknown> }> | undefined, usuarioId: number | null, revisoes: z.infer<typeof revisaoRetroativaSchema> = []) {
  const participacao = await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: participacaoId } });
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucaoId: participacaoId }, include: { etapa: true }, orderBy: { etapa: { ordem: "asc" } } });
  let automaticas = tarefas.filter(t => (t.momentoSnapshot as Record<string, unknown> | null)?.politicaExecucao === "AUTOMATICA_EXCECAO");
  const revisadas = revisoes.filter(r => r.animalId === participacao.animalId);
  if (new Set(revisadas.map(r => r.etapaId)).size !== revisadas.length) throw new RebanhoError("VALIDACAO", "Revisão retroativa duplicada");
  for (const revisao of revisadas) {
    const tarefa = automaticas.find(t => t.etapaId === revisao.etapaId);
    if (!tarefa) throw new RebanhoError("VALIDACAO", "A revisão retroativa deve corresponder a uma ação automática deste animal");
    const politica = politicaSchema.parse(tarefa.momentoSnapshot);
    const programada = tarefa.precisaoTemporal === "HORA" ? tarefa.previstaPara : instanteProgramado(tarefa.previstaPara.toISOString().slice(0, 10), politica.horarioPadrao, politica.fusoHorario);
    if (programada > new Date()) throw new RebanhoError("VALIDACAO", "A revisão retroativa só se aplica a etapas vencidas");
    if (!usuarioId) throw new RebanhoError("VALIDACAO", "Revisão retroativa exige usuário autenticado");
    await autorizarTx(tx, usuarioId);
    await tx.tarefaProtocolo.update({ where: { id: tarefa.id }, data: { historicoRegularizacao: json([...(Array.isArray(tarefa.historicoRegularizacao) ? tarefa.historicoRegularizacao : []), { acao: "REVISAO_AUTOMACAO_RETROATIVA", ...revisao, usuarioId, revisadaEm: new Date().toISOString() }]), ...(revisao.decisao === "DISPENSAR" ? { dispensadaEm: new Date(), motivoDispensa: revisao.motivo } : {}) } });
    await auditar(tx, { entidade: "TarefaProtocolo", entidadeId: tarefa.id, animalId: participacao.animalId, propriedadeId, usuarioId, acao: "REVISAO_INICIO_RETROATIVO", antes: tarefa.momentoSnapshot ?? undefined, depois: revisao });
  }
  automaticas = automaticas.filter(t => !revisadas.some(r => r.etapaId === t.etapaId));
  const dados = (entradas ?? []).filter(i => i.animalId === participacao.animalId);
  if (!automaticas.length && !dados.length) return;
  if (!usuarioId) throw new RebanhoError("VALIDACAO", "Automações exigem usuário autenticado responsável pela autorização");
  if (dados.length !== automaticas.length || new Set(dados.map(i => i.etapaId)).size !== dados.length || dados.some(i => !automaticas.some(t => t.etapaId === i.etapaId))) throw new RebanhoError("VALIDACAO", "Preencha os dados de todas as ações automáticas antes de iniciar o protocolo", "automacoes");
  const grupos = new Map<string, Entrada["itens"]>();
  for (const tarefa of automaticas) {
    const entrada = dados.find(i => i.etapaId === tarefa.etapaId)!;
    const { insercaoEtapaId, ...campos } = entrada.dados;
    const insercao = insercaoEtapaId ? tarefas.find(t => t.etapaId === insercaoEtapaId) : null;
    if (insercaoEtapaId && !insercao) throw new RebanhoError("VALIDACAO", "A ação de inserção não pertence a este protocolo");
    const item = itemAutomaticoSchema.parse({ ...campos, tipo: tarefa.etapa.tipo, tarefaId: tarefa.id, animalId: participacao.animalId, propriedadeId, data: tarefa.previstaPara.toISOString().slice(0, 10), ...(insercao ? { insercaoTarefaId: insercao.id } : {}) });
    const momentoId = (tarefa.momentoSnapshot as Record<string, string>).id;
    grupos.set(momentoId, [...(grupos.get(momentoId) ?? []), item]);
  }
  for (const [momentoId, itens] of grupos) await ativarAutomacaoTx(tx, { participacaoId, propriedadeId, momentoId, itens }, usuarioId);
}

export const previaAutomacoesAdesaoSchema = z.object({ propriedadeId: z.number().int().positive(), protocoloId: z.string().uuid(), animais: z.array(z.object({ animalId: z.string().uuid(), inicioPrevisto: z.string().refine(v => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && Number.isFinite(Date.parse(v)), "Data inválida") }).strict()).min(1).max(100) }).strict();
export async function preverAutomacoesAdesao(entrada: unknown) {
  const input = previaAutomacoesAdesaoSchema.parse(entrada);
  const { deslocarCalendario } = await import("./calendario.calc.js");
  const { lerDataIatf } = await import("../reproducao/horarios.calc.js");
  const { env } = await import("../../../env.js");
  const protocolo = await prisma.protocolo.findFirst({ where: { id: input.protocoloId, tipo: "REPRODUTIVO", publicado: true, ativo: true }, include: { etapas: { include: { momento: true }, orderBy: { ordem: "asc" } } } });
  if (!protocolo) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo publicado não encontrado");
  const agora = new Date();
  const itens = input.animais.flatMap(animal => protocolo.etapas.flatMap(etapa => {
    if (etapa.momento?.politicaExecucao !== "AUTOMATICA_EXCECAO") return [];
    const temporal = lerDataIatf(animal.inicioPrevisto);
    const previsaoPendente = temporal.precisao === "DIA" && (etapa.unidadeIntervalo === "HORAS" || !Number.isInteger(etapa.diaRelativo));
    const prevista = previsaoPendente ? temporal.instante : deslocarCalendario(temporal.instante, etapa.diaRelativo, z.enum(["DIAS", "HORAS"]).parse(etapa.unidadeIntervalo), temporal.precisao);
    const programada = previsaoPendente ? null : temporal.precisao === "HORA" ? prevista : instanteProgramado(prevista.toISOString().slice(0, 10), etapa.momento.horarioPadrao!, etapa.momento.fusoHorario!);
    return [{ animalId: animal.animalId, etapaId: etapa.id, momentoId: etapa.momento.id, nome: etapa.nome, programadaPara: programada?.toISOString() ?? null, vencida: programada != null && programada <= agora, previsaoPendente }];
  }));
  return { automacaoHabilitada: env.REPRODUCAO_AUTOMACAO_ENABLED, referencia: agora.toISOString(), itens };
}

/** Lembrete do dia conserva etapas executadas: lembrete não é confirmação clínica. */
export async function listarLembretesAutomacoes(propriedadeId: number, data: string) {
  const dia = z.string().date().parse(data);
  const inicio = instanteProgramado(dia, "00:00", "America/Sao_Paulo");
  const proximoDia = new Date(Date.parse(`${dia}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const fim = instanteProgramado(proximoDia, "00:00", "America/Sao_Paulo");
  return prisma.automacaoProtocolo.findMany({ where: { propriedadeId, programadaPara: { gte: inicio, lt: fim }, estado: { in: ["AGENDADA", "EXECUTADA", "FALHOU", "REVERTIDA"] } }, select: { id: true, participacaoId: true, momentoId: true, estado: true, programadaPara: true, executadaEm: true, erro: true, momento: { select: { id: true, nome: true } }, participacao: { select: { rodadaId: true, animal: { select: { id: true, brinco: true, nome: true } } } } }, orderBy: [{ programadaPara: "asc" }, { id: "asc" }] });
}

export async function obterPreparacaoAutomacao(id: string, propriedadeId: number, verValores: boolean) {
  const job = await prisma.automacaoProtocolo.findFirst({ where: { id, propriedadeId } });
  if (!job) throw new RebanhoError("NAO_ENCONTRADO", "Automação não encontrada neste sítio");
  const configuracao = ativarAutomacaoSchema.parse(job.configuracao);
  return { id: job.id, estado: job.estado, programadaPara: job.programadaPara, configuracao: { ...configuracao, itens: configuracao.itens.map(item => { if (verValores || !("valorServicoAtribuido" in item)) return item; const { valorServicoAtribuido: _, ...dados } = item; return dados; }) } };
}
