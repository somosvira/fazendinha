import { describe, expect, it } from "vitest";
import { patchProdutoSchema, produtoSchema } from "./produtos.schemas.js";

describe("produtoSchema", () => {
  it("aceita produto sem fornecedor e aplica defaults", () => {
    const r = produtoSchema.parse({ nome: " Sal mineral ", categoriaId: 3 });
    expect(r).toMatchObject({ nome: "Sal mineral", unidade: "UN", categoriaId: 3, centroCustoIds: [], fornecedorIds: [] });
    expect(r).not.toHaveProperty("estocavel");
  });

  it("categoria é obrigatória no create e não pode ser nula no patch", () => {
    const semCategoria = produtoSchema.safeParse({ nome: "Sal mineral" });
    expect(semCategoria.success).toBe(false);
    expect(semCategoria.error?.issues[0]).toMatchObject({ path: ["categoriaId"], message: "Produto precisa de uma categoria" });
    expect(produtoSchema.safeParse({ nome: "Sal mineral", categoriaId: null }).success).toBe(false);
    expect(patchProdutoSchema.safeParse({ categoriaId: null }).success).toBe(false);
    expect(patchProdutoSchema.safeParse({ categoriaId: 3 }).success).toBe(true);
  });

  it("rejeita fornecedores repetidos e preserva patch parcial", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", categoriaId: 3, fornecedorIds: [7, 7] }).success).toBe(false);
    expect(patchProdutoSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita centros de custo repetidos", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", categoriaId: 3, centroCustoIds: [1, 1] }).success).toBe(false);
  });

  it("aceita um produto válido", () => {
    const r = produtoSchema.safeParse({ nome: "Mastijet", unidade: "UN", categoriaId: 3 });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(produtoSchema.safeParse({ nome: "", categoriaId: 3 }).success).toBe(false);
  });
});
