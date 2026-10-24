import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

export const momentoAcaoSchema = z.object({ nome: z.string().trim().min(1).max(120), ordem: z.number().int().positive().max(100), instrucoesGerais: z.string().trim().max(2000).nullish(), modoAtendimento: z.enum(["AUTOMATIZADA", "MANUAL"]).nullish() }).strict();
export type MomentoAcao = z.infer<typeof momentoAcaoSchema>;

/** Agrupamento é explícito. Mesma data/intervalo nunca cria um momento. */
export function momentosDasAcoes(acoes: Array<{ momento?: MomentoAcao | null }>) {
  const momentos = new Map<number, MomentoAcao>();
  for (const [i, acao] of acoes.entries()) {
    if (!acao.momento) continue;
    const momento = momentoAcaoSchema.parse(acao.momento);
    const anterior = momentos.get(momento.ordem);
    if (anterior && (anterior.nome !== momento.nome || (anterior.instrucoesGerais ?? null) !== (momento.instrucoesGerais ?? null) || (anterior.modoAtendimento ?? null) !== (momento.modoAtendimento ?? null))) throw new RebanhoError("VALIDACAO", "A mesma ordem de momento precisa conservar nome, instruções e modo de atendimento", `etapas.${i}.momento`);
    momentos.set(momento.ordem, momento);
  }
  return [...momentos.values()].sort((a, b) => a.ordem - b.ordem);
}

export async function associarMomentosAcoesTx(tx: Prisma.TransactionClient, protocoloId: string, acoes: Array<{ momento?: MomentoAcao | null }>) {
  for (const momento of momentosDasAcoes(acoes)) {
    const criado = await tx.momentoProtocolo.create({ data: { protocoloId, ...momento } });
    const ordens = acoes.flatMap((a, i) => a.momento?.ordem === momento.ordem ? [i + 1] : []);
    await tx.etapaProtocolo.updateMany({ where: { protocoloId, ordem: { in: ordens } }, data: { momentoId: criado.id } });
  }
}
export function snapshotMomento(momento: { id: string; nome: string; ordem: number; instrucoesGerais?: string | null; modoAtendimento?: string | null } | null | undefined) {
  return momento ? { id: momento.id, nome: momento.nome, ordem: momento.ordem, ...(momento.instrucoesGerais != null ? { instrucoesGerais: momento.instrucoesGerais } : {}), ...(momento.modoAtendimento != null ? { modoAtendimento: momento.modoAtendimento } : {}) } : undefined;
}
