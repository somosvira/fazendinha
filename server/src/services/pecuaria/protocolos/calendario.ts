import type { Prisma, PrecisaoCalendarioProtocolo } from "@prisma/client";
import { auditar } from "../rebanho/regras.js";

/** Chamar somente com lastro de execução, na transação do fato. Não desloca o calendário programado. */
export async function registrarInicioNaExecucaoTx(tx: Prisma.TransactionClient, participacaoId: string, realizadaEm: Date, precisao: PrecisaoCalendarioProtocolo, usuarioId: number | null) {
  const antes = await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: participacaoId } });
  if (antes.inicioEfetivo || antes.origemCalendario !== "REFERENCIA_PROGRAMADA") return;
  const atualizada = await tx.participacaoProtocolo.updateMany({ where: { id: participacaoId, inicioEfetivo: null, origemCalendario: "REFERENCIA_PROGRAMADA" },
    data: { inicioEfetivo: realizadaEm, precisaoInicioEfetivo: precisao } });
  if (atualizada.count) await auditar(tx, { entidade: "ParticipacaoProtocolo", entidadeId: participacaoId, animalId: antes.animalId,
    propriedadeId: antes.propriedadeId ?? undefined, acao: "INICIO_POR_EXECUCAO", usuarioId, antes,
    depois: { ...antes, inicioEfetivo: realizadaEm, precisaoInicioEfetivo: precisao } });
}
