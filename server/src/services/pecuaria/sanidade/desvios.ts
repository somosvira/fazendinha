import { Prisma, type TarefaProtocolo, type EtapaProtocolo, type ParticipacaoProtocolo } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
import { compararParametros, exigeMotivoExecucao } from "../desvios.calc.js";

export type DesvioInput = { motivo: string };
type Tarefa = TarefaProtocolo & { etapa: EtapaProtocolo; execucao: ParticipacaoProtocolo; aplicacoes: { id: string }[]; exames: { id: string }[] };
export type RealizadoProtocolo = { tipo: "APLICACAO" | "EXAME"; data: string; produtoId?: string | null; dose?: string | null; unidade?: string | null; via?: string | null; tipoAplicacaoId?: string | null; tipoExameId?: string | null; finalidade?: string | null };
type Valor = string | null;

function texto(valor: unknown): Valor { return typeof valor === "string" ? valor.trim() || null : typeof valor === "number" || Prisma.Decimal.isDecimal(valor) ? String(valor) : null; }
function decimal(valor: Valor): Valor { return valor == null ? null : new Prisma.Decimal(valor).toString(); }

export function tipoAplicacaoLegadaId(finalidade?: string | null) {
  return finalidade === "VACINA" ? "a0300000-0000-4000-8000-000000000002" : finalidade === "VERMIFUGO" ? "a0300000-0000-4000-8000-000000000003" : "a0300000-0000-4000-8000-000000000001";
}

export function compararExecucaoProtocolo(tarefa: Tarefa, realizado: RealizadoProtocolo, desvio?: DesvioInput, exigirMotivo = true) {
  const snapshot = tarefa.parametros && typeof tarefa.parametros === "object" && !Array.isArray(tarefa.parametros) && typeof tarefa.parametros.tipo === "string" ? tarefa.parametros : null;
  const referencia = snapshot ?? tarefa.etapa;
  const campos = realizado.tipo === "APLICACAO" ? ["produtoId", "dose", "unidade", "via", "tipoAplicacaoId", "finalidade"] as const : ["tipoExameId"] as const;
  const planejado: Record<string, Valor> = { tipo: texto(referencia.tipo), data: tarefa.previstaPara.toISOString().slice(0, 10) };
  const atual: Record<string, Valor> = { tipo: realizado.tipo, data: realizado.data };
  for (const campo of campos) {
    planejado[campo] = texto(referencia[campo]);
    atual[campo] = texto(realizado[campo]);
    if (campo === "dose") { planejado[campo] = decimal(planejado[campo]); atual[campo] = decimal(atual[campo]); }
  }
  if (planejado.tipo !== realizado.tipo) throw new RebanhoError("VALIDACAO", "A natureza da tarefa não pode ser alterada", "tarefaId");
  // A finalidade legada identifica o tipo planejado; o tipo efetivo não pode ser ocultado por ela.
  if (realizado.tipo === "APLICACAO" && !planejado.tipoAplicacaoId && planejado.finalidade) {
    planejado.tipoAplicacaoId = tipoAplicacaoLegadaId(planejado.finalidade);
    atual.tipoAplicacaoId ??= atual.finalidade ? tipoAplicacaoLegadaId(atual.finalidade) : null;
  }
  if (realizado.tipo === "APLICACAO" && planejado.tipoAplicacaoId) { delete planejado.finalidade; delete atual.finalidade; }
  if (realizado.tipo === "APLICACAO" && !planejado.tipoAplicacaoId) { delete planejado.tipoAplicacaoId; delete atual.tipoAplicacaoId; }
  const comparacao = compararParametros(planejado, atual, snapshot !== null);
  const { diferencas } = comparacao;
  const motivo = desvio?.motivo?.trim() || null;
  if (motivo && (motivo.length < 5 || motivo.length > 500)) throw new RebanhoError("VALIDACAO", "Use de 5 a 500 caracteres no motivo do desvio", "desvio.motivo");
  if (exigirMotivo && exigeMotivoExecucao(comparacao) && !motivo) throw new RebanhoError("VALIDACAO", snapshot ? "Explique o desvio em relação à etapa planejada" : "Planejamento histórico não aferível: documente motivo antes da execução", "desvio.motivo");
  const exibicao = { planejado: {
    produtoId: texto(snapshot?.produtoNomeSnapshot), tipoAplicacaoId: texto(snapshot?.tipoAplicacaoNomeSnapshot), tipoExameId: texto(snapshot?.tipoExameNomeSnapshot),
  }, realizado: { produtoId: null as Valor, tipoAplicacaoId: null as Valor, tipoExameId: null as Valor } };
  return { tarefaId: tarefa.id, execucaoId: tarefa.execucao.id, protocoloId: tarefa.execucao.protocoloId, etapaId: tarefa.etapaId,
    versao: 1, aferido: comparacao.aferido, referencia: snapshot ? "SNAPSHOT_PLANEJADO" : "LEGADO_SEM_SNAPSHOT", planejado, realizado: atual, exibicao, diferencas, motivo, motivoObrigatorio: exigeMotivoExecucao(comparacao) };
}

export async function conferirTarefaProtocoloTx(tx: Prisma.TransactionClient, tarefaId: string, animalId: string, realizado: RealizadoProtocolo, desvio?: DesvioInput, exigirMotivo = true) {
  const tarefa = await tx.tarefaProtocolo.findUnique({ where: { id: tarefaId, execucao: { protocolo: { tipo: "SANITARIO" } } }, include: { etapa: true, execucao: true,
    aplicacoes: { where: { status: "VALIDO" }, select: { id: true } }, exames: { where: { status: "VALIDO" }, select: { id: true, realizacao: true } } } });
  if (!tarefa || tarefa.regularizacaoPendente || tarefa.realizadaEm && !tarefa.exames.some(e => e.realizacao === "NAO_REALIZADO") || tarefa.execucao.animalId !== animalId || tarefa.execucao.canceladaEm || tarefa.dispensadaEm || tarefa.aplicacoes.length || tarefa.exames.some(e => e.realizacao !== "NAO_REALIZADO")) {
    throw new RebanhoError("CONFLITO", realizado.tipo === "APLICACAO" ? "A tarefa não está disponível para esta aplicação" : "Tarefa de exame inválida ou já realizada", "tarefaId");
  }
  if (tarefa.etapa.protocoloId !== tarefa.execucao.protocoloId) throw new RebanhoError("CONFLITO", "A etapa não pertence à versão desta execução", "tarefaId");
  return { tarefa, desvioProtocoloSnapshot: compararExecucaoProtocolo(tarefa, realizado, desvio, exigirMotivo) };
}
