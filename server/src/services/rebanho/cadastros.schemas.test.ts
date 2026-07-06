import { describe, it, expect } from "vitest";
import { produtoSchema, fornecedorSchema } from "./cadastros.js";

describe("produtoSchema", () => {
  it("aceita um produto válido", () => {
    const r = produtoSchema.safeParse({ nome: "Mastijet", tipo: "MEDICAMENTO", unidade: "un", custoUnitario: 12.5, carencia: 96 });
    expect(r.success).toBe(true);
  });
  it("aplica unidade default 'un'", () => {
    const r = produtoSchema.safeParse({ nome: "Núcleo Mineral", tipo: "MINERAL" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unidade).toBe("un");
  });
  it("rejeita nome vazio", () => {
    expect(produtoSchema.safeParse({ nome: "", tipo: "INSUMO" }).success).toBe(false);
  });
  it("rejeita tipo inválido", () => {
    expect(produtoSchema.safeParse({ nome: "Ivermectina", tipo: "VITAMINA" }).success).toBe(false);
  });
  it("rejeita percentualMS fora de 0..100", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", tipo: "RACAO", percentualMS: 120 }).success).toBe(false);
  });
  it("aceita setor operacional válido", () => {
    const r = produtoSchema.safeParse({ nome: "Ração leiteiras", tipo: "RACAO", setor: "LEITE" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.setor).toBe("LEITE");
  });
  it("setor é opcional (produto sem setor = GERAL na exibição)", () => {
    const r = produtoSchema.safeParse({ nome: "Sal comum", tipo: "MINERAL" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.setor).toBeUndefined();
  });
  it("aceita setor null (desvincular)", () => {
    expect(produtoSchema.safeParse({ nome: "Arame", tipo: "OUTRO", setor: null }).success).toBe(true);
  });
  it("rejeita setor inválido", () => {
    expect(produtoSchema.safeParse({ nome: "Adubo", tipo: "INSUMO", setor: "SOJA" }).success).toBe(false);
  });
});

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
