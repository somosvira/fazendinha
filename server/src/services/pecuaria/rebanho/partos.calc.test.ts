import { describe, expect, it } from "vitest";
import { contarPartos, totalPartosCategoria } from "./partos.calc.js";
import { contadoresCiclo } from "../reproducao/regras.calc.js";

describe("paridade compartilhada entre categoria e reprodução", () => {
  it("conserva saldo, anulações e referência histórica, com um evento por parto", () => {
    const partos = [
      { data: new Date("2026-01-01"), status: "VALIDO", incluidoSaldoAnterior: true },
      { data: new Date("2026-02-01"), status: "VALIDO", incluidoSaldoAnterior: false },
      { data: new Date("2026-03-01"), status: "ANULADO", incluidoSaldoAnterior: false },
      { data: new Date("2026-05-01"), status: "VALIDO", incluidoSaldoAnterior: false },
    ];
    for (const [data, esperado] of [["2026-01-15", 2], ["2026-02-15", 3], ["2026-04-01", 3], ["2026-06-01", 4]] as const) {
      const referencia = new Date(data);
      expect(contarPartos(2, partos, referencia)).toBe(esperado);
      expect(totalPartosCategoria({ partosAntesDaEntrada: 2, partos }, referencia)).toBe(esperado);
      expect(contadoresCiclo(2, partos, [], referencia).partos).toBe(esperado);
    }
  });
  it("aceita a seleção legada já filtrada e não presume eventos ausentes", () => {
    expect(totalPartosCategoria({ partosAntesDaEntrada: 3 }, new Date("2026-10-14"))).toBe(3);
    expect(totalPartosCategoria({ partosAntesDaEntrada: 3, partos: [{ data: new Date("2026-01-01") }] }, new Date("2026-10-14"))).toBe(4);
  });
});
