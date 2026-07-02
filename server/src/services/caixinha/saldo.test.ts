import { describe, it, expect } from "vitest";
import { calcularSaldoCaixinha } from "./saldo.js";

describe("calcularSaldoCaixinha", () => {
  it("caixinha vazia → 0", () => {
    expect(calcularSaldoCaixinha([])).toBe(0);
  });

  it("só entradas → soma", () => {
    expect(calcularSaldoCaixinha([
      { tipo: "ENTRADA", valor: 100 },
      { tipo: "ENTRADA", valor: 250.5 },
    ])).toBe(350.5);
  });

  it("só saídas → negativo (reflete o razão real, sem mascarar)", () => {
    expect(calcularSaldoCaixinha([
      { tipo: "SAIDA", valor: 40 },
      { tipo: "SAIDA", valor: 9.99 },
    ])).toBe(-49.99);
  });

  it("misto: Σ ENTRADA − Σ SAIDA", () => {
    expect(calcularSaldoCaixinha([
      { tipo: "ENTRADA", valor: 100 },
      { tipo: "SAIDA", valor: 30.5 },
    ])).toBe(69.5);
  });

  it("arredonda a 2 casas (erro binário de float não vaza pro saldo)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 em float
    expect(calcularSaldoCaixinha([
      { tipo: "ENTRADA", valor: 0.1 },
      { tipo: "ENTRADA", valor: 0.2 },
    ])).toBe(0.3);
    // 0.3 − 0.1 = 0.19999999999999998 em float
    expect(calcularSaldoCaixinha([
      { tipo: "ENTRADA", valor: 0.3 },
      { tipo: "SAIDA", valor: 0.1 },
    ])).toBe(0.2);
  });

  it("nunca NaN: valores não-finitos são ignorados", () => {
    expect(calcularSaldoCaixinha([
      { tipo: "ENTRADA", valor: NaN },
      { tipo: "SAIDA", valor: Infinity },
      { tipo: "ENTRADA", valor: 10 },
    ])).toBe(10);
    expect(calcularSaldoCaixinha([{ tipo: "SAIDA", valor: NaN }])).toBe(0);
  });
});
