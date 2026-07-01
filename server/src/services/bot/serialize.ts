// Converte valores vindos do Prisma (Decimal, BigInt, Date) em algo
// JSON-serializável que o LLM consiga ler. Função PURA.
import { Prisma } from "@prisma/client";

export function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    // Prisma.Decimal pode escapar do instanceof entre versões; checa pelo shape.
    const anyV = value as { constructor?: { name?: string }; toNumber?: () => number };
    if (anyV.constructor?.name === "Decimal" && typeof anyV.toNumber === "function")
      return anyV.toNumber();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}
