import { conflitoTransacaoValidada, transacaoValidada } from "../../lib/transacao-validada.js";
import { Prisma } from "@prisma/client";

export function conflitoTransacaoPecuaria(erro: unknown): boolean {
  return conflitoTransacaoValidada(erro);
}

/** Reexecuta toda a confirmação, inclusive a leitura da chave idempotente. */
export async function transacaoPecuaria<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await transacaoValidada(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (erro) {
      if (!conflitoTransacaoPecuaria(erro) || tentativa >= 3) throw erro;
    }
  }
}
