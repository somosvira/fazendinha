import { describe, expect, it } from "vitest";
import { patchProdutoSchema, produtoSchema } from "./produtos.schemas.js";

describe("produtoSchema", () => {
  it("aceita produto sem fornecedor e aplica defaults", () => {
    expect(produtoSchema.parse({ nome: " Sal mineral " })).toMatchObject({
      nome: "Sal mineral", unidade: "un", estocavel: true, centroCustoIds: [], fornecedorIds: [],
    });
  });

  it("rejeita fornecedores repetidos e preserva patch parcial", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", fornecedorIds: [7, 7] }).success).toBe(false);
    expect(patchProdutoSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita centros de custo repetidos", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", centroCustoIds: [1, 1] }).success).toBe(false);
  });

  it("aceita um produto válido", () => {
    const r = produtoSchema.safeParse({ nome: "Mastijet", unidade: "un" });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(produtoSchema.safeParse({ nome: "" }).success).toBe(false);
  });
});
