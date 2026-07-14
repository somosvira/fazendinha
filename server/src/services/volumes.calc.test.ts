import { describe, it, expect } from "vitest";
import { estimarLitros, somarSacas, porUnidade } from "./volumes.calc.js";

describe("volumes.calc — estimarLitros", () => {
  it("taxa diária × dias, arredondado", () => {
    expect(estimarLitros(100, 30)).toBe(3000);
    expect(estimarLitros(33.4, 10)).toBe(334);
  });
  it("retorna 0 para taxa ou dias inválidos", () => {
    expect(estimarLitros(0, 30)).toBe(0);
    expect(estimarLitros(100, 0)).toBe(0);
    expect(estimarLitros(-5, 30)).toBe(0);
    expect(estimarLitros(NaN, 30)).toBe(0);
  });
});

describe("volumes.calc — somarSacas", () => {
  it("soma com 2 casas", () => {
    expect(somarSacas([10.5, 20.25, 5])).toBe(35.75);
  });
  it("ignora valores não-finitos e lista vazia", () => {
    expect(somarSacas([])).toBe(0);
    expect(somarSacas([10, NaN, Infinity, 5])).toBe(15);
  });
});

describe("volumes.calc — porUnidade", () => {
  it("R$/unidade arredondado a centavos", () => {
    expect(porUnidade(3100, 1000)).toBe(3.1);
    expect(porUnidade(707.4, 1)).toBe(707.4);
  });
  it("null quando volume ≤ 0 (esconde KPI, não NaN/∞)", () => {
    expect(porUnidade(1000, 0)).toBeNull();
    expect(porUnidade(1000, -1)).toBeNull();
  });
  it("null quando valor não é finito", () => {
    expect(porUnidade(NaN, 100)).toBeNull();
  });
});
