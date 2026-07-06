import { describe, it, expect } from "vitest";
import { propriedadeSchema } from "./propriedade.js";

describe("propriedadeSchema", () => {
  it("aceita o mínimo (só nome)", () => {
    const r = propriedadeSchema.safeParse({ nome: "Recria" });
    expect(r.success).toBe(true);
  });

  it("aceita campos completos", () => {
    const r = propriedadeSchema.safeParse({ nome: "Recria", apelido: "Recria", cidade: "Uberaba", uf: "MG", principal: false, ativo: true, ordem: 1 });
    expect(r.success).toBe(true);
  });

  it("exige nome não-vazio", () => {
    expect(propriedadeSchema.safeParse({ nome: "" }).success).toBe(false);
  });

  it("UF precisa ter 2 letras", () => {
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "MGX" }).success).toBe(false);
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "M" }).success).toBe(false);
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "MG" }).success).toBe(true);
  });
});
