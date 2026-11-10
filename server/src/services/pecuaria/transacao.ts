import { conflitoTransacaoValidada, transacaoValidada } from "../../lib/transacao-validada.js";
import { Prisma } from "@prisma/client";

export function conflitoTransacaoPecuaria(erro: unknown): boolean {
  return conflitoTransacaoValidada(erro);
}

const TIMEOUT_PADRAO_MS = 30_000;
// Calibrado para produção (Worker → Neon por WebSocket): cada cadastro faz ~20–30 consultas em sequência.
const TIMEOUT_POR_ANIMAL_MS = 600;
const TIMEOUT_TETO_MS = 120_000;

/** Limite de tempo da transação que cadastra, baixa ou reativa vários animais: base + 600 ms por animal, até 120 s. */
export function timeoutTransacaoAnimais(animais: number): number {
  return Math.min(TIMEOUT_PADRAO_MS + TIMEOUT_POR_ANIMAL_MS * Math.max(0, Math.trunc(animais)), TIMEOUT_TETO_MS);
}

/** Reexecuta toda a confirmação, inclusive a leitura da chave idempotente. */
export async function transacaoPecuaria<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>, opcoes: { timeout?: number } = {}): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await transacaoValidada(executar, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: opcoes.timeout ?? TIMEOUT_PADRAO_MS });
    } catch (erro) {
      if (!conflitoTransacaoPecuaria(erro) || tentativa >= 3) throw erro;
    }
  }
}
