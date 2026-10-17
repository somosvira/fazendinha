import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

type OpcoesTransacao = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };
/** Valida somente depois de concluir todos os fatos, inversos, parcelas e auditorias.
 * Uma violação diferida falha ainda no callback, permitindo ROLLBACK/release pelo
 * adapter. Não evita outras causas de falha de COMMIT nem relaxa constraints. */
export async function concluirTransacaoValidadaTx<T>(tx: Prisma.TransactionClient, executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const resultado = await executar(tx);
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  return resultado;
}
export async function transacaoValidada<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>, opcoes?: OpcoesTransacao): Promise<T> {
  return prisma.$transaction(tx => concluirTransacaoValidadaTx(tx, executar), opcoes);
}
