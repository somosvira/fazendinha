import { describe, it, expect } from "vitest";
import { fornecedorSchema } from "./cadastros.js";

describe("fornecedorSchema", () => {
  it("aceita um fornecedor válido", () => {
    const r = fornecedorSchema.safeParse({ nome: "Cargill", tipo: "FORNECEDOR", telefone: "1199999", email: "vendas@cargill.com" });
    expect(r.success).toBe(true);
  });
  it("aceita email vazio (string vazia)", () => {
    expect(fornecedorSchema.safeParse({ nome: "Coop. Boa Vista", email: "" }).success).toBe(true);
  });
  it("rejeita email inválido", () => {
    expect(fornecedorSchema.safeParse({ nome: "Cargill", email: "não-é-email" }).success).toBe(false);
  });
  it("rejeita nome vazio", () => {
    expect(fornecedorSchema.safeParse({ nome: "" }).success).toBe(false);
  });
  it("rejeita tipo inválido", () => {
    expect(fornecedorSchema.safeParse({ nome: "Cargill", tipo: "PESSOA_FISICA" }).success).toBe(false);
  });
});
