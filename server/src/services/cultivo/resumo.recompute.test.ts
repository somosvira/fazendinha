import { describe, it, expect } from "vitest";
import { calcularResumoSafra } from "./resumo.recompute.js";

const base = { areaHaTotal: 0, areas: [], custos: [], producoes: [] };

describe("calcularResumoSafra", () => {
  it("soma custeio e investimento separados e horas de máquina", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 100,
      custos: [
        { classe: "CUSTEIO", valor: 3000, horasMaquina: 10 },
        { classe: "CUSTEIO", valor: 2000, horasMaquina: 5 },
        { classe: "INVESTIMENTO", valor: 8000 },
      ],
    });
    expect(r.custeioTotal).toBe(5000);
    expect(r.investimentoTotal).toBe(8000);
    expect(r.horasMaquinaTotal).toBe(15);
    expect(r.areaHa).toBe(100);
    expect(r.custoHa).toBe(50); // 5000/100
  });

  it("custoHa null quando área é zero", () => {
    const r = calcularResumoSafra({ ...base, areaHaTotal: 0, custos: [{ classe: "CUSTEIO", valor: 100 }] });
    expect(r.custoHa).toBeNull();
  });

  it("nível-safra, saída única grão: custoSaca = custeio/sacas, custoTonelada null", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 50,
      custos: [{ classe: "CUSTEIO", valor: 10000 }],
      producoes: [{ tipo: "GRAO", quantidade: 500 }],
    });
    expect(r.producaoGraoSc).toBe(500);
    expect(r.custoSaca).toBe(20); // 10000/500
    expect(r.custoTonelada).toBeNull();
    expect(r.nota).toBeNull();
  });

  it("nível-safra, saída mista sem áreas: custoSaca e custoTonelada null + nota", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 100,
      custos: [{ classe: "CUSTEIO", valor: 10000 }],
      producoes: [
        { tipo: "GRAO", quantidade: 500 },
        { tipo: "SILAGEM", quantidade: 200 },
      ],
    });
    expect(r.custoSaca).toBeNull();
    expect(r.custoTonelada).toBeNull();
    expect(r.custoHa).toBe(100); // custoHa sempre válido
    expect(r.nota).toMatch(/mista/i);
  });

  it("com áreas: rateia custeio por saída da área", () => {
    // área 1 (grão): custeio 6000, 300 sacas → 20/sc
    // área 2 (silagem): custeio 4000, 100 ton → 40/ton
    const r = calcularResumoSafra({
      areaHaTotal: 0,
      areas: [{ id: 1, areaHa: 60 }, { id: 2, areaHa: 40 }],
      custos: [
        { classe: "CUSTEIO", valor: 6000, areaCultivoId: 1 },
        { classe: "CUSTEIO", valor: 4000, areaCultivoId: 2 },
      ],
      producoes: [
        { tipo: "GRAO", quantidade: 300, areaCultivoId: 1 },
        { tipo: "SILAGEM", quantidade: 100, areaCultivoId: 2 },
      ],
    });
    expect(r.areaHa).toBe(100); // soma das áreas
    expect(r.custoSaca).toBe(20);
    expect(r.custoTonelada).toBe(40);
    expect(r.nota).toBeNull();
  });

  it("sem produção: custos por unidade null, sem NaN", () => {
    const r = calcularResumoSafra({ ...base, areaHaTotal: 10, custos: [{ classe: "CUSTEIO", valor: 100 }] });
    expect(r.custoSaca).toBeNull();
    expect(r.custoTonelada).toBeNull();
    expect(Number.isNaN(r.custoHa as number)).toBe(false);
  });
});
