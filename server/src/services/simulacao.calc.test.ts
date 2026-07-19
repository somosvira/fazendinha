import { describe, it, expect } from "vitest";
import {
  simularPrecoLeite, simularTrocaRacao,
  type BasePrecoLeite, type BaseRacao,
} from "./simulacao.calc.js";

describe("simularPrecoLeite", () => {
  // Base sintética: 100.000 L no período, preço médio real R$ 2,00/L → receita 200k;
  // custeio do leite 150k → margem 50k; fluxo do período 40k.
  const base: BasePrecoLeite = {
    litros: 100_000,
    precoMedio: 2,
    receitaLeite: 200_000,
    custeioLeite: 150_000,
    fluxoPeriodo: 40_000,
  };

  it("+10% no preço: receita e margem sobem pela variação sobre a receita de leite", () => {
    const r = simularPrecoLeite(base, 10);
    expect(r.precoSimulado).toBeCloseTo(2.2, 6);
    expect(r.receitaLeiteSimulada).toBe(220_000); // 100.000 × 2,20
    expect(r.deltaReceita).toBe(20_000);
    expect(r.margemLeiteBase).toBe(50_000);
    expect(r.margemLeiteSimulada).toBe(70_000); // +20k de receita cai direto na margem
    expect(r.fluxoPeriodoSimulado).toBe(60_000); // fluxo base + delta receita
  });

  it("−15% no preço derruba receita e margem proporcionalmente", () => {
    const r = simularPrecoLeite(base, -15);
    expect(r.precoSimulado).toBeCloseTo(1.7, 6);
    expect(r.receitaLeiteSimulada).toBe(170_000);
    expect(r.deltaReceita).toBe(-30_000);
    expect(r.margemLeiteSimulada).toBe(20_000);
    expect(r.fluxoPeriodoSimulado).toBe(10_000);
  });

  it("delta 0 é identidade", () => {
    const r = simularPrecoLeite(base, 0);
    expect(r.receitaLeiteSimulada).toBe(base.receitaLeite);
    expect(r.deltaReceita).toBe(0);
    expect(r.fluxoPeriodoSimulado).toBe(base.fluxoPeriodo);
  });

  it("litros 0 → receita simulada 0 e delta = −receita base (sem divisão por zero no preço)", () => {
    const r = simularPrecoLeite({ ...base, litros: 0, receitaLeite: 0 }, 10);
    expect(r.receitaLeiteSimulada).toBe(0);
    expect(r.deltaReceita).toBe(0);
  });
});

describe("simularTrocaRacao", () => {
  // Base: custo vaca/dia real R$ 10,00 com 50 vacas em lactação → 500/dia; 30 dias.
  const base: BaseRacao = {
    custoVacaDiaAtual: 10,
    vacasEmLactacao: 50,
    periodoDias: 30,
  };

  it("ração 8% mais barata reduz o custo vaca/dia e o custo mensal do lote", () => {
    const r = simularTrocaRacao(base, { variacaoPct: -8 });
    expect(r.custoVacaDiaSimulado).toBeCloseTo(9.2, 6); // 10 × 0,92
    expect(r.deltaVacaDia).toBeCloseTo(-0.8, 6);
    // custo mensal do lote = custo vaca/dia × vacas × dias
    expect(r.custoMensalAtual).toBe(15_000); // 10 × 50 × 30
    expect(r.custoMensalSimulado).toBe(13_800); // 9,2 × 50 × 30
    expect(r.economiaMensal).toBe(1_200); // atual − simulado
  });

  it("ração mais cara aumenta o custo (economia negativa)", () => {
    const r = simularTrocaRacao(base, { variacaoPct: 5 });
    expect(r.custoVacaDiaSimulado).toBeCloseTo(10.5, 6);
    expect(r.economiaMensal).toBe(-750); // 10×50×30 − 10,5×50×30 = −750
  });

  it("preço absoluto por vaca/dia sobrepõe a variação percentual quando informado", () => {
    const r = simularTrocaRacao(base, { custoVacaDiaNovo: 7.5 });
    expect(r.custoVacaDiaSimulado).toBe(7.5);
    expect(r.economiaMensal).toBe(3_750); // (10−7,5)×50×30
  });

  it("sem vacas em lactação → custo mensal 0, mas custo vaca/dia ainda é simulado", () => {
    const r = simularTrocaRacao({ ...base, vacasEmLactacao: 0 }, { variacaoPct: -8 });
    expect(r.custoVacaDiaSimulado).toBeCloseTo(9.2, 6);
    expect(r.custoMensalSimulado).toBe(0);
    expect(r.economiaMensal).toBe(0);
  });
});
