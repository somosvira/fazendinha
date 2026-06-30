import { describe, it, expect } from "vitest";
import { calcularEconomiaCorte } from "./custo.js";

// Testa o NÚCLEO PURO da economia de corte (sem Prisma): @ produzidas, custo/@,
// custo/cabeça, estoque biológico, margem. Os custos vêm dos dados do módulo
// (suplementação + sanidade) — não de uma ponte financeira fabricada.

describe("calcularEconomiaCorte (núcleo puro)", () => {
  it("deriva custeio, custo/@ e custo/cabeça das operações do módulo", () => {
    const r = calcularEconomiaCorte({
      vendas: [
        { receitaTotal: 82593.96, arrobas: 243.64 },
        { receitaTotal: 27600, arrobas: 112.0 },
      ],
      // 2 suplementações: 120 g/cab/dia × R$4,80/kg × cabeças × dias
      // lote A: 120g=0,12kg × 4,8 × 48 cab × 100 d = 2764,8
      // lote B: 120g=0,12kg × 4,8 × 20 cab × 50 d  = 576,0
      suplementacoes: [
        { consumoCabecaDiaG: 120, custoKg: 4.8, numCabecas: 48, dias: 100 },
        { consumoCabecaDiaG: 120, custoKg: 4.8, numCabecas: 20, dias: 50 },
      ],
      sanitarioCabecasAplicadas: 200, // 200 cab × R$6 = 1200
      custoSanitarioPorCabeca: 6,
      lotesEstoque: [
        { arrobasEstimadas: 15, numCabecas: 48 }, // 720 @
        { arrobasEstimadas: 10, numCabecas: 20 }, // 200 @
      ],
      custoFinanceiroExtra: 0,
      precoArrobaSpot: 245,
    });

    expect(r.receita).toBe(110193.96);
    expect(r.arrobasProduzidas).toBe(355.64);
    // suplementação 2764,8 + 576 = 3340,8
    expect(r.custoSuplementacao).toBe(3340.8);
    expect(r.custoSanitario).toBe(1200);
    expect(r.custeioTotal).toBe(4540.8);
    // custo/@ = 4540,8 / 355,64
    expect(r.custoArroba).toBeCloseTo(12.77, 1);
    // custo/cabeça = 4540,8 / (48+20) = 66,78
    expect(r.custoPorCabeca).toBeCloseTo(66.78, 1);
    // estoque biológico = (720 + 200) @ × 245 = 225400
    expect(r.arrobasEstoque).toBe(920);
    expect(r.valorBiologicoEstoque).toBe(225400);
    expect(r.margemBruta).toBe(105653.16);
  });

  it("custoKg null não soma suplementação (estimativa honesta)", () => {
    const r = calcularEconomiaCorte({
      vendas: [],
      suplementacoes: [{ consumoCabecaDiaG: 120, custoKg: null, numCabecas: 50, dias: 100 }],
      sanitarioCabecasAplicadas: 0,
      custoSanitarioPorCabeca: 6,
      lotesEstoque: [],
      custoFinanceiroExtra: 0,
      precoArrobaSpot: 245,
    });
    expect(r.custoSuplementacao).toBe(0);
    expect(r.custeioTotal).toBe(0);
  });

  it("sem vendas → custoArroba null (não divide por zero); sem cabeças → custoPorCabeca null", () => {
    const r = calcularEconomiaCorte({
      vendas: [],
      suplementacoes: [{ consumoCabecaDiaG: 100, custoKg: 5, numCabecas: 10, dias: 10 }],
      sanitarioCabecasAplicadas: 0,
      custoSanitarioPorCabeca: 6,
      lotesEstoque: [],
      custoFinanceiroExtra: 0,
      precoArrobaSpot: 245,
    });
    expect(r.custeioTotal).toBe(50); // 0,1kg × 5 × 10 × 10
    expect(r.custoArroba).toBeNull();
    expect(r.custoPorCabeca).toBeNull();
    expect(r.valorBiologicoEstoque).toBe(0);
  });

  it("custoFinanceiroExtra (centro de custo de corte) entra no custeio quando existe", () => {
    const r = calcularEconomiaCorte({
      vendas: [{ receitaTotal: 1000, arrobas: 4 }],
      suplementacoes: [],
      sanitarioCabecasAplicadas: 0,
      custoSanitarioPorCabeca: 6,
      lotesEstoque: [{ arrobasEstimadas: 10, numCabecas: 5 }],
      custoFinanceiroExtra: 800,
      precoArrobaSpot: 245,
    });
    expect(r.custoFinanceiroExtra).toBe(800);
    expect(r.custeioTotal).toBe(800);
    expect(r.custoArroba).toBe(200); // 800 / 4
  });
});
