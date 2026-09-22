import { describe, expect, it } from "vitest";
import { criarOperacaoSchema } from "./schemas.js";

const base = {
  dominio: "NUTRICAO" as const,
  tipo: "ADUBACAO_SOLO" as const,
  data: "2026-01-10",
};

describe("criarOperacaoSchema — limites de quantidadeTotal e doseValor", () => {
  it("aceita valores dentro do limite compatível com Decimal(12,2)", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: 9_999_999_999.99, doseValor: 9_999_999_999.99 });
    expect(r.success).toBe(true);
  });

  it("rejeita quantidadeTotal acima do limite", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: 10_000_000_000 });
    expect(r.success).toBe(false);
  });

  it("rejeita doseValor acima do limite", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, doseValor: 10_000_000_000 });
    expect(r.success).toBe(false);
  });

  it("rejeita quantidadeTotal não finito (Infinity)", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: Infinity });
    expect(r.success).toBe(false);
  });

  it("rejeita quantidadeTotal negativo", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: -1 });
    expect(r.success).toBe(false);
  });

  it("aceita quantidadeTotal e doseValor ausentes (nullish)", () => {
    const r = criarOperacaoSchema.safeParse(base);
    expect(r.success).toBe(true);
  });
});
