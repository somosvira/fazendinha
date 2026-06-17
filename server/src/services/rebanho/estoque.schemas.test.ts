import { describe, it, expect } from "vitest";
import { movimentoSchema } from "./estoque.js";

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

describe("movimentoSchema", () => {
  it("aceita um movimento válido", () => {
    const r = movimentoSchema.safeParse({ produtoId: 1, tipo: "ENTRADA", data: ontem, quantidade: 1000, custoUnitario: 2.1, fornecedorId: 3 });
    expect(r.success).toBe(true);
  });
  it("custoUnitario é opcional", () => {
    const r = movimentoSchema.safeParse({ produtoId: 1, tipo: "SAIDA", data: ontem, quantidade: 300 });
    expect(r.success).toBe(true);
  });
  it("rejeita sem produtoId", () => {
    expect(movimentoSchema.safeParse({ tipo: "ENTRADA", data: ontem, quantidade: 10 }).success).toBe(false);
  });
  it("rejeita quantidade <= 0", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "ENTRADA", data: ontem, quantidade: 0 }).success).toBe(false);
  });
  it("rejeita data futura", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "ENTRADA", data: amanha, quantidade: 10 }).success).toBe(false);
  });
  it("rejeita tipo inválido", () => {
    expect(movimentoSchema.safeParse({ produtoId: 1, tipo: "DEVOLUCAO", data: ontem, quantidade: 10 }).success).toBe(false);
  });
});
