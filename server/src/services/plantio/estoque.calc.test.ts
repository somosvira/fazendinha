import { describe, it, expect } from "vitest";
import { calcularSaldo, calcularValor, abaixoDoMinimo, type MovEstoque } from "./estoque.calc.js";

describe("calcularSaldo", () => {
  it("entrada soma e saída subtrai", () => {
    const movs: MovEstoque[] = [
      { tipo: "ENTRADA", quantidade: 4_800 },
      { tipo: "SAIDA", quantidade: 1_200 },
    ];
    expect(calcularSaldo(movs)).toBe(3_600);
  });

  it("lista vazia → saldo zero", () => {
    expect(calcularSaldo([])).toBe(0);
  });

  it("AJUSTE com quantidade negativa subtrai do saldo", () => {
    const movs: MovEstoque[] = [
      { tipo: "ENTRADA", quantidade: 100 },
      { tipo: "AJUSTE", quantidade: -10 },
    ];
    expect(calcularSaldo(movs)).toBe(90);
  });

  it("AJUSTE positivo soma ao saldo", () => {
    const movs: MovEstoque[] = [
      { tipo: "ENTRADA", quantidade: 50 },
      { tipo: "AJUSTE", quantidade: 5 },
    ];
    expect(calcularSaldo(movs)).toBe(55);
  });

  it("preserva casas decimais (frações de L/kg)", () => {
    const movs: MovEstoque[] = [
      { tipo: "ENTRADA", quantidade: 6.5 },
      { tipo: "SAIDA", quantidade: 0.25 },
    ];
    expect(calcularSaldo(movs)).toBe(6.25);
  });
});

describe("calcularValor", () => {
  it("saldo × custoUnitário", () => {
    expect(calcularValor(4_800, 3)).toBe(14_400);
  });

  it("custo nulo → valor zero", () => {
    expect(calcularValor(100, null)).toBe(0);
  });

  it("custo zero → valor zero", () => {
    expect(calcularValor(100, 0)).toBe(0);
  });

  it("arredonda a 2 casas", () => {
    expect(calcularValor(3, 4.605)).toBe(13.82);
  });
});

describe("abaixoDoMinimo", () => {
  it("saldo abaixo do mínimo → true", () => {
    expect(abaixoDoMinimo(2_200, 2_500)).toBe(true);
  });

  it("saldo no mínimo → false (não perfura)", () => {
    expect(abaixoDoMinimo(2_500, 2_500)).toBe(false);
  });

  it("saldo acima do mínimo → false", () => {
    expect(abaixoDoMinimo(4_800, 2_000)).toBe(false);
  });

  it("mínimo nulo → false (sem mínimo cadastrado)", () => {
    expect(abaixoDoMinimo(0, null)).toBe(false);
  });
});
