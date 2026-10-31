import { reconciliarParticipacaoAlertaTx } from "../sanidade/alertas/protocolos.js";
import { z } from "zod";
import { type Prisma, type TipoProtocolo } from "@prisma/client";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { dataOuHorario } from "../reproducao/schemas.js";
import { anteriorIatf, lerDataIatf } from "../reproducao/horarios.calc.js";

export const eventoTarefaSchema = z.object({
  chave: z.string().uuid(), propriedadeId: z.number().int().positive().max(2147483647),
  tipo: z.enum(["NAO_ATENDIDO", "ADIAMENTO", "RETIFICACAO_JUSTIFICATIVA"]),
  ocorridaEm: z.string().datetime({ offset: true }), motivo: z.string().trim().min(5).max(1000),
  previstaPara: dataOuHorario.optional(), eventoCorrigidoId: z.string().uuid().optional(),
}).strict().superRefine((v, ctx) => {
  if ((v.tipo === "ADIAMENTO") !== (v.previstaPara != null)) ctx.addIssue({ code: "custom", path: ["previstaPara"], message: "Somente adiamento exige nova previsão" });
  if ((v.tipo === "RETIFICACAO_JUSTIFICATIVA") !== (v.eventoCorrigidoId != null)) ctx.addIssue({ code: "custom", path: ["eventoCorrigidoId"], message: "Somente retificação exige o evento corrigido" });
});
export type EventoTarefaInput = z.infer<typeof eventoTarefaSchema>;

/** Histórico operacional sem criação de fato clínico, serviço ou movimento de estoque. */
export async function registrarEventoTarefaTx(tx: Prisma.TransactionClient, id: string, entrada: EventoTarefaInput, usuarioId: number | null, tipo?: TipoProtocolo) {
  const input = eventoTarefaSchema.parse(entrada);
  const referencia = await tx.tarefaProtocolo.findFirst({ where: { OR: [{ id }, { legadoIatfId: id }], execucao: { protocolo: tipo ? { tipo } : {} } }, select: { id: true, execucao: { select: { animalId: true } } } });
  if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
  await travarAnimais(tx, [referencia.execucao.animalId]);
  await tx.$queryRaw`SELECT id FROM pecuaria."TarefaProtocolo" WHERE id=${referencia.id} FOR UPDATE`;
  return operacaoIdempotenteTx(tx, { ...input, tarefaId: referencia.id }, usuarioId, "EVENTO_TAREFA_PROTOCOLO", async () => {
    const tarefa = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: referencia.id }, include: {
      execucao: { include: { rodada: true } }, etapa: true,
      aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } }, tentativas: { where: { status: "VALIDO" } },
      vinculos: { include: { aplicacao: true, exame: true, tentativa: true } },
    } });
    if (tarefa.execucao.propriedadeId !== input.propriedadeId)
      throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste sítio");
    if (tarefa.etapa.protocoloId !== tarefa.execucao.protocoloId)
      throw new RebanhoError("CONFLITO", "A etapa não pertence à versão desta participação");
    const ocorridaEm = new Date(input.ocorridaEm);
    if (ocorridaEm > new Date()) throw new RebanhoError("VALIDACAO", "O evento deve ter ocorrido até agora", "ocorridaEm");
    if (input.tipo === "RETIFICACAO_JUSTIFICATIVA") {
      const original = await tx.eventoTarefaProtocolo.findUnique({ where: { id: input.eventoCorrigidoId! } });
      if (!original || original.tarefaId !== tarefa.id || original.tipo === "RETIFICACAO_JUSTIFICATIVA")
        throw new RebanhoError("VALIDACAO", "Selecione um evento operacional desta tarefa", "eventoCorrigidoId");
      if (ocorridaEm < original.ocorridaEm) throw new RebanhoError("VALIDACAO", "Retificação não pode anteceder o evento original", "ocorridaEm");
    } else {
      const consumoMantido = tarefa.vinculos.some(v => v.aplicacao?.consumoMantido || v.tentativa?.consumoMantido);
      const encerrada = tarefa.vinculos.some(v => v.estado === "ENCERRADO");
      if (tarefa.regularizacaoPendente || consumoMantido || encerrada || tarefa.realizadaEm || tarefa.dispensadaEm || tarefa.execucao.canceladaEm || tarefa.execucao.rodada && tarefa.execucao.rodada.status !== "ABERTA" || tarefa.aplicacoes.length || tarefa.exames.length || tarefa.tentativas.length)
        throw new RebanhoError("CONFLITO", "A tarefa não está pendente para esta ação");
    }
    const nova = input.tipo === "ADIAMENTO" ? lerDataIatf(input.previstaPara!) : null;
    if (nova && !anteriorIatf(tarefa.previstaPara, tarefa.precisaoTemporal, nova.instante, nova.precisao))
      throw new RebanhoError("VALIDACAO", "Escolha uma previsão posterior à atual", "previstaPara");
    // CURRENT_TIMESTAMP é o início da transação, podendo anteceder uma gravação que esperou a trava.
    // Reserva ordem temporal por tarefa, inclusive em duas inserções no mesmo milissegundo.
    const ultimo = await tx.eventoTarefaProtocolo.findFirst({ where: { tarefaId: tarefa.id }, orderBy: [{ registradoEm: "desc" }, { id: "desc" }], select: { registradoEm: true } });
    const registradoEm = new Date(Math.max(Date.now(), (ultimo?.registradoEm.getTime() ?? 0) + 1));
    const evento = await tx.eventoTarefaProtocolo.create({ data: {
      tarefaId: tarefa.id, tipo: input.tipo, ocorridaEm, registradoEm, motivo: input.motivo,
      eventoCorrigidoId: input.eventoCorrigidoId,
      registradoPorId: usuarioId != null && usuarioId > 0 ? usuarioId : null,
      ...(nova ? { previsaoAnterior: tarefa.previstaPara, precisaoAnterior: tarefa.precisaoTemporal, previsaoNova: nova.instante, precisaoNova: nova.precisao } : {}),
    } });
    if (nova) await tx.tarefaProtocolo.update({ where: { id: tarefa.id }, data: {
      previstaPara: nova.instante, precisaoTemporal: nova.precisao, previsaoPendente: false,
      previsaoOriginal: tarefa.previsaoOriginal ?? tarefa.previstaPara,
    } });
    await auditar(tx, { entidade: "EventoTarefaProtocolo", entidadeId: evento.id, animalId: tarefa.execucao.animalId,
      propriedadeId: input.propriedadeId, acao: input.tipo, usuarioId, depois: evento });
    await reconciliarParticipacaoAlertaTx(tx, tarefa.execucaoId, usuarioId);
    return evento;
  });
}
export const registrarEventoTarefa = (id: string, input: EventoTarefaInput, usuarioId: number | null, tipo?: TipoProtocolo) =>
  transacaoPecuaria(tx => registrarEventoTarefaTx(tx, id, input, usuarioId, tipo));
