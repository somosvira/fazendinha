import { describe, expect, it } from "vitest";
import { patchProdutoSchema, produtoSchema } from "./produtos.schemas.js";
import { uid } from "../../lib/uid.fixture.js";

describe("produtoSchema", () => {
  it("aceita produto sem fornecedor e aplica defaults", () => {
    const r = produtoSchema.parse({ nome: " Sal mineral ", categoriaId: uid(3) });
    expect(r).toMatchObject({ nome: "Sal mineral", unidade: "UN", categoriaId: uid(3), centroCustoIds: [], fornecedorIds: [] });
    expect(r).not.toHaveProperty("estocavel");
  });

  it("categoria é obrigatória no create e não pode ser nula no patch", () => {
    const semCategoria = produtoSchema.safeParse({ nome: "Sal mineral" });
    expect(semCategoria.success).toBe(false);
    expect(semCategoria.error?.issues[0]).toMatchObject({ path: ["categoriaId"], message: "Produto precisa de uma categoria" });
    expect(produtoSchema.safeParse({ nome: "Sal mineral", categoriaId: null }).success).toBe(false);
    expect(patchProdutoSchema.safeParse({ categoriaId: null }).success).toBe(false);
    expect(patchProdutoSchema.safeParse({ categoriaId: uid(3) }).success).toBe(true);
  });

  it("rejeita fornecedores repetidos e preserva patch parcial", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", categoriaId: uid(3), fornecedorIds: [uid(7), uid(7)] }).success).toBe(false);
    expect(patchProdutoSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita centros de custo repetidos", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", categoriaId: uid(3), centroCustoIds: [uid(1), uid(1)] }).success).toBe(false);
  });

  it("aceita um produto válido", () => {
    const r = produtoSchema.safeParse({ nome: "Mastijet", unidade: "UN", categoriaId: uid(3) });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(produtoSchema.safeParse({ nome: "", categoriaId: uid(3) }).success).toBe(false);
  });

  it.each([-1, 101])("recusa MS %s com caminho do campo e mensagem em português", (valor) => {
    const resultado = patchProdutoSchema.safeParse({ perfilNutricional: { materiaSecaPercentual: valor } });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]).toMatchObject({ path: ["perfilNutricional", "materiaSecaPercentual"], message: "Informe a matéria seca entre 0% e 100%." });
  });

  it.each([0, 100, 90.25, null])("mantém MS %s sem converter vazio em zero", (valor) => {
    expect(patchProdutoSchema.parse({ perfilNutricional: { materiaSecaPercentual: valor } }).perfilNutricional?.materiaSecaPercentual).toBe(valor);
  });
});
