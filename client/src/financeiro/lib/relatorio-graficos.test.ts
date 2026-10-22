import { describe, expect, it } from "vitest";
import { serieCaixaMensal } from "./relatorio-graficos";

describe("série mensal do relatório salvo", () => {
  it("acumula o resultado preservado sem inferir saldo de contas, abertura ou lucro", () => {
    const meses = [
      { mes: "2026-08", entradas: 60000, saidas: 0, resultado: 60000 },
      { mes: "2026-09", entradas: 0, saidas: 250, resultado: -250 },
      { mes: "2026-10", entradas: 0, saidas: 0, resultado: 0 },
    ];
    expect(serieCaixaMensal(meses).map(ponto => ponto.acumulado)).toEqual([60000, 59750, 59750]);
    expect(meses[2]).not.toHaveProperty("acumulado");
  });
  it("preserva centavos, sinais e meses zerados ao ordenar uma cópia", () => {
    const meses = [
      { mes: "2026-10", entradas: 0, saidas: 0, resultado: 0 },
      { mes: "2026-09", entradas: 0, saidas: .3, resultado: -.3 },
      { mes: "2026-08", entradas: .1, saidas: 0, resultado: .1 },
    ];
    expect(serieCaixaMensal(meses).map(ponto => [ponto.mes, ponto.acumulado])).toEqual([["2026-08", .1], ["2026-09", -.2], ["2026-10", -.2]]);
    expect(meses[0].mes).toBe("2026-10");
  });
  it("usa o resultado mensal autoritativo sem reconstruir totais de outra leitura", () => {
    expect(serieCaixaMensal([{ mes: "2026-08", entradas: 10, saidas: 0, resultado: 7 }])[0].acumulado).toBe(7);
    expect(serieCaixaMensal([])).toEqual([]);
  });
});
