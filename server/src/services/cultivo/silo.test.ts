import { describe, it, expect } from "vitest";
import { calcularSaldoSilo } from "./silo.js";

describe("calcularSaldoSilo", () => {
  it("saldo = entradas - saídas", () => {
    expect(calcularSaldoSilo([
      { tipo: "ENTRADA", quantidade: 100 },
      { tipo: "ENTRADA", quantidade: 50 },
      { tipo: "SAIDA", quantidade: 30 },
    ])).toBe(120);
  });

  it("silo vazio → 0", () => {
    expect(calcularSaldoSilo([])).toBe(0);
  });

  it("não fica negativo silenciosamente — reflete o razão real", () => {
    expect(calcularSaldoSilo([{ tipo: "SAIDA", quantidade: 10 }])).toBe(-10);
  });
});
