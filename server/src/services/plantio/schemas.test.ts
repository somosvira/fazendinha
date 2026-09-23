import { describe, expect, it } from "vitest";
import { criarOperacaoSchema } from "./schemas.js";

const base = {
  dominio: "NUTRICAO" as const,
  tipo: "ADUBACAO_SOLO" as const,
  data: "2026-01-10",
};

describe("criarOperacaoSchema — limites de quantidadeTotal e doseValor", () => {
  it("aceita quantidadeTotal no limite máximo, compatível com Decimal(12,3)", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: 999_999_999.999 });
    expect(r.success).toBe(true);
  });

  it("aceita doseValor no limite máximo, compatível com Decimal(10,3)", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, doseValor: 9_999_999.999 });
    expect(r.success).toBe(true);
  });

  it("rejeita quantidadeTotal acima do limite", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, quantidadeTotal: 1_000_000_000 });
    expect(r.success).toBe(false);
  });

  it("rejeita doseValor acima do limite da coluna Decimal(10,3), mesmo dentro do limite de quantidadeTotal", () => {
    const r = criarOperacaoSchema.safeParse({ ...base, doseValor: 10_000_000 });
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
