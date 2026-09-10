import { describe, it, expect } from "vitest";
import { movimentoSchema } from "./estoque.js";

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const PRODUTO_ID = "00000000-0000-4000-8000-000000000001";

describe("movimentoSchema", () => {
  it("aceita um movimento válido", () => {
    const r = movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "ENTRADA", data: ontem, quantidade: 1000, custoUnitario: 2.1, observacao: "Ajuste conferido" });
    expect(r.success).toBe(true);
  });
  it("custoUnitario é opcional", () => {
    const r = movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "SAIDA", data: ontem, quantidade: 300, observacao: "Ajuste conferido" });
    expect(r.success).toBe(true);
  });
  it("rejeita sem produtoId", () => {
    expect(movimentoSchema.safeParse({ tipo: "ENTRADA", data: ontem, quantidade: 10 }).success).toBe(false);
  });
  it("rejeita quantidade zero", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "ENTRADA", data: ontem, quantidade: 0 }).success).toBe(false);
  });
  it("rejeita ENTRADA com quantidade negativa", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "ENTRADA", data: ontem, quantidade: -5 }).success).toBe(false);
  });
  it("aceita AJUSTE com quantidade negativa (correção de saldo)", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "AJUSTE", data: ontem, quantidade: -5, observacao: "Contagem física corrigida" }).success).toBe(true);
  });
  it("rejeita data futura", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "ENTRADA", data: amanha, quantidade: 10 }).success).toBe(false);
  });
  it("rejeita tipo inválido", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "DEVOLUCAO", data: ontem, quantidade: 10 }).success).toBe(false);
  });
  it("rejeita ajuste sem justificativa", () => {
    expect(movimentoSchema.safeParse({ produtoId: PRODUTO_ID, tipo: "AJUSTE", data: ontem, quantidade: 10 }).success).toBe(false);
  });
});
