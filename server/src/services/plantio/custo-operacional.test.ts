import { describe, it, expect } from "vitest";
import { calcularCustoOperacionalCafe } from "./custo-operacional.js";

// Testa o NÚCLEO PURO do custo OPERACIONAL do café (sem Prisma): custeio =
// Σ tarefas.custoReal + Σ apontamentos.valorTotal; custo/saca e custo/ha
// dividem sobre esse custeio, nunca NaN em divisão por zero.

describe("calcularCustoOperacionalCafe (núcleo puro)", () => {
  it("soma tarefas + apontamentos e divide por sacas/área (caso normal)", () => {
    const r = calcularCustoOperacionalCafe({
      tarefas: [{ custoReal: 1000 }, { custoReal: 2500.5 }],
      apontamentos: [{ valorTotal: 800 }, { valorTotal: 199.5 }],
      sacas: 100,
      areaHa: 20,
    });
    // custeio = 1000 + 2500,5 + 800 + 199,5 = 4500
    expect(r.custeioTotal).toBe(4500);
    expect(r.custoSaca).toBe(45); // 4500 / 100
    expect(r.custoHa).toBe(225); // 4500 / 20
  });

  it("sacas <= 0 → custoSaca null (custoHa continua válido)", () => {
    const r = calcularCustoOperacionalCafe({
      tarefas: [{ custoReal: 1000 }],
      apontamentos: [],
      sacas: 0,
      areaHa: 10,
    });
    expect(r.custeioTotal).toBe(1000);
    expect(r.custoSaca).toBeNull();
    expect(r.custoHa).toBe(100);
  });

  it("área <= 0 → custoHa null (custoSaca continua válido)", () => {
    const r = calcularCustoOperacionalCafe({
      tarefas: [{ custoReal: 500 }],
      apontamentos: [{ valorTotal: 500 }],
      sacas: 50,
      areaHa: 0,
    });
    expect(r.custeioTotal).toBe(1000);
    expect(r.custoSaca).toBe(20);
    expect(r.custoHa).toBeNull();
  });

  it("vazio (sem tarefas/apontamentos/sacas/área) → tudo null/0, nunca NaN", () => {
    const r = calcularCustoOperacionalCafe({
      tarefas: [],
      apontamentos: [],
      sacas: 0,
      areaHa: 0,
    });
    expect(r.custeioTotal).toBe(0);
    expect(r.custoSaca).toBeNull();
    expect(r.custoHa).toBeNull();
    expect(Number.isNaN(r.custeioTotal)).toBe(false);
  });

  it("sacas e área negativas também tratadas como divisão inválida → null", () => {
    const r = calcularCustoOperacionalCafe({
      tarefas: [{ custoReal: 300 }],
      apontamentos: [],
      sacas: -5,
      areaHa: -1,
    });
    expect(r.custoSaca).toBeNull();
    expect(r.custoHa).toBeNull();
  });
});
