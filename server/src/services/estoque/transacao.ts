import { conflitoTransacaoValidada, transacaoValidada } from "../../lib/transacao-validada.js";
import { Prisma } from "@prisma/client";

/** Refaz toda a conferência somente em conflito transitório de serialização ou deadlock. */
export async function transacaoEstoque<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await transacaoValidada(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (erro) {
      if (!conflitoTransacaoValidada(erro) || tentativa >= 3) throw erro;
    }
  }
}
