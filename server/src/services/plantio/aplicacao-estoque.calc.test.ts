import { describe, expect, it } from "vitest";
import { parseDoseUnidadeLegada, planejarBaixaAplicacao, textoDoseUnidade } from "./aplicacao-estoque.calc.js";

describe("planejarBaixaAplicacao", () => {
  it("multiplica dose por hectare pela área quando dosePorHectare é true", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
    });
    expect(r).toEqual({ quantidade: 6, deveBaixar: true });
  });

  it("usa a dose como total quando não é por hectare", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "KG",
      doseValor: 10, doseUnidadeMedida: "KG", dosePorHectare: false, areaHa: 3,
    });
    expect(r).toEqual({ quantidade: 10, deveBaixar: true });
  });

  it("converte a dose para a unidade do produto quando a base é a mesma", () => {
    // 200 mL/ha × 5 ha = 1000 mL = 1 L
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 200, doseUnidadeMedida: "ML", dosePorHectare: true, areaHa: 5,
    });
    expect(r).toEqual({ quantidade: 1, deveBaixar: true });
  });

  it("lança erro claro quando a dose e o produto têm bases diferentes", () => {
    expect(() => planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "KG",
      doseValor: 200, doseUnidadeMedida: "ML", dosePorHectare: true, areaHa: 5,
    })).toThrow();
  });

  it("prioriza a quantidade total informada explicitamente", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
      quantidadeTotalInformada: 100,
    });
    expect(r).toEqual({ quantidade: 100, deveBaixar: true });
  });

  it("não baixa sem produtoId", () => {
    const r = planejarBaixaAplicacao({
      produtoId: null, estocavel: true, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
    });
    expect(r.deveBaixar).toBe(false);
  });

  it("não baixa quando o produto não é estocável", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: false, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
    });
    expect(r.deveBaixar).toBe(false);
  });

  it("não baixa quando a quantidade resulta zero ou negativa", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 0, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
    });
    expect(r.deveBaixar).toBe(false);
  });

  it("trata área ausente como zero (sem dose total informada)", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: null,
    });
    expect(r).toEqual({ quantidade: 0, deveBaixar: false });
  });

  it("arredonda a quantidade para 3 casas decimais (coluna Decimal(12,3))", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 1.2345, doseUnidadeMedida: "L", dosePorHectare: true, areaHa: 3,
    });
    expect(r).toEqual({ quantidade: 3.704, deveBaixar: true });
  });

  it("sem doseUnidadeMedida e sem quantidadeTotalInformada não baixa", () => {
    const r = planejarBaixaAplicacao({
      produtoId: 1, estocavel: true, produtoUnidade: "L",
      doseValor: 2, doseUnidadeMedida: null, dosePorHectare: true, areaHa: 3,
    });
    expect(r).toEqual({ quantidade: 0, deveBaixar: false });
  });
});

describe("textoDoseUnidade", () => {
  it("monta o rótulo com /ha quando é por hectare", () => {
    expect(textoDoseUnidade("ML", true)).toBe("mL/ha");
    expect(textoDoseUnidade("KG", false)).toBe("kg");
  });

  it("null sem unidade", () => {
    expect(textoDoseUnidade(null, true)).toBeNull();
  });
});

describe("parseDoseUnidadeLegada", () => {
  it("reconhece unidade por hectare", () => {
    expect(parseDoseUnidadeLegada("L/ha")).toEqual({ unidade: "L", porHectare: true });
    expect(parseDoseUnidadeLegada("kg/ha")).toEqual({ unidade: "KG", porHectare: true });
  });

  it("reconhece unidade sem /ha", () => {
    expect(parseDoseUnidadeLegada("kg")).toEqual({ unidade: "KG", porHectare: false });
    expect(parseDoseUnidadeLegada("mL")).toEqual({ unidade: "ML", porHectare: false });
  });

  it("vazio/desconhecido", () => {
    expect(parseDoseUnidadeLegada(null)).toEqual({ unidade: null, porHectare: false });
    expect(parseDoseUnidadeLegada("xyz")).toEqual({ unidade: null, porHectare: false });
  });
});
