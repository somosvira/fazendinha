import { describe, expect, it } from "vitest";
import { planejarBaixaAplicacao } from "./aplicacao-estoque.calc.js";

describe("planejarBaixaAplicacao", () => {
  it("multiplica dose por hectare pela área quando a unidade termina em /ha", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 2, doseUnidade: "L/ha", areaHa: 3 });
    expect(r).toEqual({ quantidade: 6, deveBaixar: true });
  });

  it("usa a dose como total quando a unidade não é por hectare", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 10, doseUnidade: "kg", areaHa: 3 });
    expect(r).toEqual({ quantidade: 10, deveBaixar: true });
  });

  it("prioriza a quantidade total informada explicitamente", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 2, doseUnidade: "L/ha", areaHa: 3, quantidadeTotalInformada: 100 });
    expect(r).toEqual({ quantidade: 100, deveBaixar: true });
  });

  it("não baixa sem produtoId", () => {
    const r = planejarBaixaAplicacao({ produtoId: null, estocavel: true, doseValor: 2, doseUnidade: "L/ha", areaHa: 3 });
    expect(r.deveBaixar).toBe(false);
  });

  it("não baixa quando o produto não é estocável", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: false, doseValor: 2, doseUnidade: "L/ha", areaHa: 3 });
    expect(r.deveBaixar).toBe(false);
  });

  it("não baixa quando a quantidade resulta zero ou negativa", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 0, doseUnidade: "L/ha", areaHa: 3 });
    expect(r.deveBaixar).toBe(false);
  });

  it("trata área ausente como zero (sem dose total informada)", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 2, doseUnidade: "L/ha", areaHa: null });
    expect(r).toEqual({ quantidade: 0, deveBaixar: false });
  });

  it("arredonda a quantidade para 3 casas decimais (coluna Decimal(12,3))", () => {
    const r = planejarBaixaAplicacao({ produtoId: 1, estocavel: true, doseValor: 1.2345, doseUnidade: "L/ha", areaHa: 3 });
    expect(r).toEqual({ quantidade: 3.704, deveBaixar: true });
  });
});
