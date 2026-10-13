import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
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
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
  const antes = await tx.requisicaoPecuaria.findUnique({
      where: { chave: input.chave },
    }),
    hashPayload = hashDados(input);
  if (antes) {
    if (
      antes.hashPayload !== hashPayload ||
      antes.operacao !== operacao ||
      antes.propriedadeId !== input.propriedadeId ||
      antes.usuarioId !== usuarioId
    )
      throw new RebanhoError(
        "CONFLITO",
        "Chave de reenvio usada com outros dados",
      );
    return antes.resultadoIds as T;
  }
  const resultado = await executar();
  await tx.requisicaoPecuaria.create({
    data: {
      chave: input.chave,
      propriedadeId: input.propriedadeId,
      usuarioId,
      operacao,
      hashPayload,
      resultadoIds: JSON.parse(JSON.stringify(resultado)),
    },
  });
  return resultado;
}
