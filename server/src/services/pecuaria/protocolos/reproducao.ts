import { associarMomentosAcoesTx, snapshotMomento } from "./momentos.js";
import { reservarVersaoTx } from "./versoes.js";
import { vincularFatoTarefaTx, encerrarVinculoAtualTx } from "./vinculos.js";
import { Prisma, type ProtocoloIatf, type ProgramacaoIatf, type ParticipanteIatf, type TarefaIatf } from "@prisma/client";
import { etapaIatfSchema } from "../reproducao/schemas.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { RebanhoError } from "../rebanho/regras.js";
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
type Tx = Prisma.TransactionClient;
type Entidade = "protocolo" | "programacao" | "participacao" | "tarefa";

/** Resolve também IDs anteriores à migração, sempre no contexto reprodutivo. */
export async function resolverIdReprodutivoTx(tx: Tx, entidade: Entidade, id: string): Promise<string> {
  const identidade = { OR: [{ id }, { legadoIatfId: id }] };
  const registro = entidade === "protocolo" ? await tx.protocolo.findFirst({ where: { ...identidade, tipo: "REPRODUTIVO" }, select: { id: true } })
    : entidade === "programacao" ? await tx.programacaoProtocolo.findFirst({ where: { ...identidade, protocolo: { tipo: "REPRODUTIVO" } }, select: { id: true } })
    : entidade === "participacao" ? await tx.participacaoProtocolo.findFirst({ where: { ...identidade, protocolo: { tipo: "REPRODUTIVO" } }, select: { id: true } })
    : await tx.tarefaProtocolo.findFirst({ where: { ...identidade, execucao: { protocolo: { tipo: "REPRODUTIVO" } } }, select: { id: true } });
  if (!registro) throw new RebanhoError("NAO_ENCONTRADO", "Registro reprodutivo não encontrado");
  return registro.id;
}

type DadosProtocolo = Pick<ProtocoloIatf, "nome" | "versao"> & { id?: string; etapas: Prisma.InputJsonValue; publicado?: boolean; criadoEm?: Date; criadoPorId?: number | null; descricao?: string | null;referenciaTecnica?:Prisma.InputJsonValue };
export async function criarProtocoloReprodutivoTx(tx: Tx, { data }: { data: DadosProtocolo }): Promise<ProtocoloIatf> {
  const etapas = etapasReprodutivasDoContrato(data.etapas);
  const versao = await reservarVersaoTx(tx, "REPRODUTIVO", data.nome.trim(), data.versao);
  const p = await tx.protocolo.create({ data: { id: data.id, tipo: "REPRODUTIVO", nome: data.nome.trim(), descricao: data.descricao, versao,
    publicado: false, referenciaTecnica:data.referenciaTecnica, criadoEm: data.criadoEm, criadoPorId: data.criadoPorId, etapas: { create: etapas } } });
  await associarMomentosAcoesTx(tx, p.id, Array.isArray(data.etapas) ? data.etapas.map(e => { const { referencias: _referencias, ...campos } = e as Record<string, Prisma.InputJsonValue>; return etapaIatfSchema.parse(campos); }) : []);
  if (data.publicado) await tx.protocolo.update({ where: { id: p.id }, data: { publicado: true, publicadoEm: new Date() } });
  return tx.protocoloIatf.findUniqueOrThrow({ where: { id: p.id } });
}

export function etapasReprodutivasDoContrato(etapasEntrada: Prisma.InputJsonValue) {
  if (!Array.isArray(etapasEntrada)) throw new RebanhoError("VALIDACAO", "Informe as etapas da versão", "etapas");
  return etapasEntrada.map((item, indice) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new RebanhoError("VALIDACAO", "Etapa inválida", "etapas");
    const { referencias, ...campos } = item;
    const e = etapaIatfSchema.parse(campos);
    return { ordem: indice + 1, nome: e.nome, tipo: e.tipo === "AVALIACAO" ? "EXAME" : e.tipo,
      diaRelativo: e.intervalo, unidadeIntervalo: e.unidade,
      produtoId: e.planoAplicacao?.produtoId, materialId: e.planoTentativa?.materialId,
      tipoExameId: e.tipo === "AVALIACAO" ? e.planoAvaliacao?.tipoExameId ?? TIPO_EXAME_REPRODUTIVO : e.planoExame?.tipoExameId,
      dose: e.planoAplicacao?.dose, unidade: e.planoAplicacao?.unidadeDose, via: e.planoAplicacao?.via,
      configuracao: json({ ...e, ...(referencias ? { referencias } : {}) }) };
  });
}

type DadosProgramacao = Pick<ProgramacaoIatf, "propriedadeId" | "protocoloId" | "nome" | "inicioPrevisto"> & Partial<Pick<ProgramacaoIatf, "id" | "referenciaExterna" | "status" | "criadoEm" | "criadoPorId" | "precisaoTemporal">>;
export async function criarProgramacaoReprodutivaTx(tx: Tx, { data }: { data: DadosProgramacao }): Promise<ProgramacaoIatf> {
  const protocoloId = await resolverIdReprodutivoTx(tx, "protocolo", data.protocoloId);
  const { inicioPrevisto, ...campos } = data;
  const p = await tx.programacaoProtocolo.create({ data: { ...campos, protocoloId, inicioReferencia: inicioPrevisto, precisaoTemporal: data.precisaoTemporal ?? "HORA" } });
  return tx.programacaoIatf.findUniqueOrThrow({ where: { id: p.id } });
}

type DadosParticipacao = Pick<ParticipanteIatf, "animalId" | "inicioPrevisto"> & { programacaoId: string } & Partial<Pick<ParticipanteIatf, "id" | "referenciaExterna" | "inicioEfetivo" | "encerradoEm" | "motivoEncerramento" | "criadoEm" | "criadoPorId" | "precisaoTemporal" | "precisaoInicioEfetivo">>;
export async function criarParticipacaoReprodutivaTx(tx: Tx, { data }: { data: DadosParticipacao }): Promise<ParticipanteIatf> {
  const rodadaId = await resolverIdReprodutivoTx(tx, "programacao", data.programacaoId);
  const programa = await tx.programacaoProtocolo.findUniqueOrThrow({ where: { id: rodadaId } });
  const p = await tx.participacaoProtocolo.create({ data: { id: data.id, referenciaExterna: data.referenciaExterna,
    rodadaId, origemCalendario: "REFERENCIA_PROGRAMADA", protocoloId: programa.protocoloId, propriedadeId: programa.propriedadeId, animalId: data.animalId,
    inicio: data.inicioPrevisto, inicioEfetivo: data.inicioEfetivo, precisaoTemporal: data.precisaoTemporal ?? "HORA", precisaoInicioEfetivo: data.precisaoInicioEfetivo ?? (data.inicioEfetivo ? "HORA" : null),
    canceladaEm: data.encerradoEm, motivoCancelamento: data.motivoEncerramento, criadoEm: data.criadoEm, criadoPorId: data.criadoPorId } });
  return tx.participanteIatf.findUniqueOrThrow({ where: { id: p.id } });
}

export async function atualizarParticipacaoReprodutivaTx(tx: Tx, input: { where: { id: string }; data: { inicioEfetivo?: Date | null; precisaoInicioEfetivo?: "DIA" | "HORA"; encerradoEm?: Date | null; motivoEncerramento?: string | null } }): Promise<ParticipanteIatf> {
  const id = await resolverIdReprodutivoTx(tx, "participacao", input.where.id);
  await tx.participacaoProtocolo.update({ where: { id }, data: { inicioEfetivo: input.data.inicioEfetivo, precisaoInicioEfetivo: input.data.precisaoInicioEfetivo, canceladaEm: input.data.encerradoEm, motivoCancelamento: input.data.motivoEncerramento } });
  return tx.participanteIatf.findUniqueOrThrow({ where: { id } });
}

type Vinculos = { aplicacaoId?: string | null; tentativaId?: string | null; avaliacaoId?: string | null; exameId?: string | null };
type AtualizacaoTarefa = Pick<Prisma.TarefaProtocoloUncheckedUpdateInput, "previsaoOriginal" | "realizadaEm" | "dispensadaEm" | "historicoReprogramacao" | "realizadoSnapshot" | "desviosSnapshot" | "regularizacaoPendente" | "historicoRegularizacao" | "precisaoTemporal" | "precisaoRealizacao" | "previsaoPendente"> & Vinculos & {
  previstaEm?: Date; motivo?: string | null; planejadoSnapshot?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};
async function vincularFatosTx(tx: Tx, tarefaId: string, data: Vinculos, usuarioId: number | null = null, regularizacao?: { acao: string; motivo: string }) {
  if (!data.aplicacaoId && !data.avaliacaoId && !data.tentativaId && !data.exameId) return;
  const exameId = data.avaliacaoId ? (await tx.interpretacaoReprodutiva.findUniqueOrThrow({ where: { id: data.avaliacaoId } })).exameId : data.exameId;
  await vincularFatoTarefaTx(tx, tarefaId, { aplicacaoId: data.aplicacaoId, tentativaId: data.tentativaId, exameId }, usuarioId, regularizacao ? "REGULARIZACAO" : "EXECUCAO", regularizacao?.motivo);
}
export async function atualizarTarefaReprodutivaTx(tx: Tx, input: { where: { id: string }; data: AtualizacaoTarefa; usuarioId?: number | null; regularizacao?: { acao: string; motivo: string } }): Promise<TarefaIatf> {
  const id = await resolverIdReprodutivoTx(tx, "tarefa", input.where.id);
  const { previstaEm, motivo, planejadoSnapshot, aplicacaoId, tentativaId, avaliacaoId, exameId, ...data } = input.data;
  await tx.tarefaProtocolo.update({ where: { id }, data: { ...data, previstaPara: previstaEm, motivoDispensa: motivo, parametros: planejadoSnapshot } });
  if (input.regularizacao && input.regularizacao.acao !== "VINCULAR_SUBSTITUTO") await encerrarVinculoAtualTx(tx, id, input.regularizacao.acao === "REABRIR" ? "REABERTO" : "ENCERRADO", input.regularizacao.motivo);
  await vincularFatosTx(tx, id, { aplicacaoId, tentativaId, avaliacaoId, exameId }, input.usuarioId ?? null, input.regularizacao);
  return tx.tarefaIatf.findUniqueOrThrow({ where: { id } });
}

type DadosTarefa = Pick<TarefaIatf, "participanteId" | "etapa" | "tipo" | "nome" | "previstaEm" | "previsaoOriginal"> & Vinculos & {
  id?: string; precisaoTemporal?: "DIA" | "HORA"; precisaoRealizacao?: "DIA" | "HORA" | null; previsaoPendente?: boolean; realizadaEm?: Date | null; dispensadaEm?: Date | null; motivo?: string | null;
  planejadoSnapshot?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  realizadoSnapshot?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  desviosSnapshot?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  historicoReprogramacao?: Prisma.InputJsonValue; historicoRegularizacao?: Prisma.InputJsonValue; regularizacaoPendente?: boolean;
};
async function prepararTarefaTx(tx: Tx, data: DadosTarefa): Promise<Prisma.TarefaProtocoloUncheckedCreateInput> {
  const execucaoId = await resolverIdReprodutivoTx(tx, "participacao", data.participanteId);
  const participante = await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: execucaoId } });
  const etapa = await tx.etapaProtocolo.findUniqueOrThrow({ where: { protocoloId_ordem: { protocoloId: participante.protocoloId, ordem: data.etapa + 1 } }, include: { momento: true } });
  if (etapa.tipo !== (data.tipo === "AVALIACAO" ? "EXAME" : data.tipo)) throw new RebanhoError("CONFLITO", "A tarefa não corresponde à ação da etapa");
  return { ...dadosTarefaProtocolo(data, execucaoId, etapa.id), momentoSnapshot: snapshotMomento(etapa.momento) };
}
function dadosTarefaProtocolo(data: DadosTarefa, execucaoId: string, etapaId: string): Prisma.TarefaProtocoloUncheckedCreateInput {
  return { id: data.id, nomeSnapshot: data.nome, execucaoId, etapaId, previstaPara: data.previstaEm, previsaoOriginal: data.previsaoOriginal,
    precisaoTemporal: data.precisaoTemporal ?? "HORA", precisaoRealizacao: data.precisaoRealizacao ?? (data.realizadaEm ? "HORA" : null), previsaoPendente: data.previsaoPendente ?? false, parametros: data.planejadoSnapshot, realizadaEm: data.realizadaEm,
    dispensadaEm: data.dispensadaEm, motivoDispensa: data.motivo, realizadoSnapshot: data.realizadoSnapshot,
    desviosSnapshot: data.desviosSnapshot,
    historicoReprogramacao: data.historicoReprogramacao,
    regularizacaoPendente: data.regularizacaoPendente,
    historicoRegularizacao: data.historicoRegularizacao };
}
export async function criarTarefaReprodutivaTx(tx: Tx, { data }: { data: DadosTarefa }): Promise<TarefaIatf> {
  const t = await tx.tarefaProtocolo.create({ data: await prepararTarefaTx(tx, data) });
  await vincularFatosTx(tx, t.id, data);
  return tx.tarefaIatf.findUniqueOrThrow({ where: { id: t.id } });
}
export async function criarTarefasReprodutivasTx(tx: Tx, { data }: { data: DadosTarefa[] }) {
  if (data.some(t => t.aplicacaoId || t.avaliacaoId || t.tentativaId || t.exameId)) throw new RebanhoError("VALIDACAO", "O planejamento coletivo não vincula fatos realizados");
  const ids = [...new Set(data.map(t => t.participanteId))];
  const participantes = await tx.participacaoProtocolo.findMany({ where: { protocolo: { tipo: "REPRODUTIVO" }, OR: [{ id: { in: ids } }, { legadoIatfId: { in: ids } }] }, include: { protocolo: { include: { etapas: { include: { momento: true } } } } } });
  const tarefas = data.map(t => {
    const p = participantes.find(p => p.id === t.participanteId || p.legadoIatfId === t.participanteId);
    const etapa = p?.protocolo.etapas.find(e => e.ordem === t.etapa + 1);
    if (!p || !etapa || etapa.tipo !== (t.tipo === "AVALIACAO" ? "EXAME" : t.tipo)) throw new RebanhoError("CONFLITO", "Etapa incompatível com a participação planejada");
    return { ...dadosTarefaProtocolo(t, p.id, etapa.id), momentoSnapshot: snapshotMomento(etapa.momento) };
  });
  return tx.tarefaProtocolo.createMany({ data: tarefas });
}
export async function dispensarPendenciasReprodutivasTx(tx: Tx, input: { where: { participanteId: string; realizadaEm: null; dispensadaEm: null }; data: { dispensadaEm: Date; motivo: string } }) {
  const execucaoId = await resolverIdReprodutivoTx(tx, "participacao", input.where.participanteId);
  return tx.tarefaProtocolo.updateMany({ where: { execucaoId, realizadaEm: null, dispensadaEm: null }, data: { dispensadaEm: input.data.dispensadaEm, motivoDispensa: input.data.motivo } });
}
