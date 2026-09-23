import { describe, expect, it } from "vitest";
import { patchProdutoSchema, produtoSchema } from "./produtos.schemas.js";

describe("produtoSchema", () => {
  it("aceita produto sem fornecedor e aplica defaults", () => {
    expect(produtoSchema.parse({ nome: " Sal mineral " })).toMatchObject({
      nome: "Sal mineral", tipo: "INSUMO", unidade: "un", estocavel: true, centroCustoIds: [], fornecedorIds: [],
    });
  });

  it("rejeita fornecedores repetidos e preserva patch parcial", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", fornecedorIds: [7, 7] }).success).toBe(false);
    expect(patchProdutoSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita centros de custo repetidos", () => {
    expect(produtoSchema.safeParse({ nome: "Ração", centroCustoIds: [1, 1] }).success).toBe(false);
  });

  it("aceita um produto válido de medicamento", () => {
    const r = produtoSchema.safeParse({ nome: "Mastijet", tipo: "MEDICAMENTO", unidade: "un", custoUnitario: 12.5 });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(produtoSchema.safeParse({ nome: "" }).success).toBe(false);
  });

  it("rejeita tipo inválido", () => {
    expect(produtoSchema.safeParse({ nome: "Ivermectina", tipo: "VITAMINA" }).success).toBe(false);
  });

  it("aceita subtipoPlantio válido", () => {
    const r = produtoSchema.safeParse({ nome: "Calcário", tipo: "INSUMO", subtipoPlantio: "CORRETIVO" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.subtipoPlantio).toBe("CORRETIVO");
  });

  it("rejeita subtipoPlantio inválido", () => {
    expect(produtoSchema.safeParse({ nome: "Calcário", subtipoPlantio: "SOJA" }).success).toBe(false);
  });
});
