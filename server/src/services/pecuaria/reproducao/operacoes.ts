import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { recuperarRequisicaoTx, guardarRequisicaoTx } from "../requisicoes.js";
export function hashDados(v: unknown): string {
  const ordenar = (x: unknown): unknown =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, ordenar(v)]),
        )
      : Array.isArray(x)
        ? x.map(ordenar)
        : x;
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(ordenar(JSON.parse(JSON.stringify(v) ?? "null"))))
    .digest("hex");
}
export async function operacaoIdempotenteTx<
  T,
  I extends { chave: string; propriedadeId: number },
>(
  tx: Prisma.TransactionClient,
  input: I,
  usuarioId: number | null,
  operacao: string,
  executar: () => Promise<T>,
): Promise<T> {
  const identidade = { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao, hashPayload: hashDados(input) };
  const antes = await recuperarRequisicaoTx(tx, identidade);
  if (antes) {
    return antes.resultadoIds as T;
  }
  const resultado = await executar();
  await guardarRequisicaoTx(tx, identidade, JSON.parse(JSON.stringify(resultado)));
  return resultado;
}
