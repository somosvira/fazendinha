import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

/** Reexecuta toda a confirmação, inclusive a leitura da chave idempotente. */
export async function transacaoPecuaria<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await prisma.$transaction(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2034" || tentativa >= 3) throw erro;
    }
  }
}
