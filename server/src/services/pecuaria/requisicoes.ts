import type { Prisma, RequisicaoPecuaria } from "@prisma/client";
import { RebanhoError } from "./rebanho/regras.js";

export type IdentidadeRequisicao = {
  chave: string;
  propriedadeId: number;
  usuarioId: number | null;
  operacao: string;
  hashPayload: string;
};

/** O chamador mantém a serialização histórica da sua operação e sua política de resposta. */
export async function recuperarRequisicaoTx(
  tx: Prisma.TransactionClient,
  identidade: IdentidadeRequisicao,
): Promise<RequisicaoPecuaria | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${identidade.chave}`}))`;
  const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: identidade.chave } });
  if (anterior && (anterior.hashPayload !== identidade.hashPayload ||
    anterior.usuarioId !== identidade.usuarioId || anterior.propriedadeId !== identidade.propriedadeId ||
    anterior.operacao !== identidade.operacao)) {
    throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outros dados");
  }
  return anterior;
}

export async function guardarRequisicaoTx(
  tx: Prisma.TransactionClient,
  identidade: IdentidadeRequisicao,
  resultadoIds: Prisma.InputJsonValue,
): Promise<void> {
  await tx.requisicaoPecuaria.create({ data: { ...identidade, resultadoIds } });
}
