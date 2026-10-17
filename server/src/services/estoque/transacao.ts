import { transacaoValidada } from "../../lib/transacao-validada.js";
import { Prisma } from "@prisma/client";

/** Refaz toda a conferência somente em conflito transitório de serialização. */
export async function transacaoEstoque<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await transacaoValidada(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2034" || tentativa >= 3) throw erro;
    }
  }
}
