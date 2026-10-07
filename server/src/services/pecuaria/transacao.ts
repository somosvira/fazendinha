import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export function conflitoTransacaoPecuaria(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") return true;
  // O adapter pg pode propagar o conflito diretamente na confirmação do commit.
  return erro instanceof Error && erro.name === "DriverAdapterError"
    && typeof erro.cause === "object" && erro.cause !== null
    && "kind" in erro.cause && erro.cause.kind === "TransactionWriteConflict";
}

/** Reexecuta toda a confirmação, inclusive a leitura da chave idempotente. */
export async function transacaoPecuaria<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await prisma.$transaction(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (erro) {
      if (!conflitoTransacaoPecuaria(erro) || tentativa >= 3) throw erro;
    }
  }
}
