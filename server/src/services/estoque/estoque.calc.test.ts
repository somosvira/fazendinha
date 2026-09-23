import { describe, it, expect } from "vitest";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";

const HOJE = "2026-06-17";

describe("saldoProduto", () => {
  it("entrada soma e saída subtrai (saldo + valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "SAIDA", quantidade: 30, valorTotal: 60, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 70, valor: 140 });
  });

  it("lista vazia → saldo e valor zero", () => {
    expect(saldoProduto([])).toEqual({ saldo: 0, valor: 0 });
  });

  it("AJUSTE com quantidade negativa subtrai (mesmo sinal no valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "AJUSTE", quantidade: -10, valorTotal: -20, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 90, valor: 180 });
  });
});

describe("custoVacaDia", () => {
  it("consumo ÷ (vacas × dias)", () => {
    // 2100 / (7 * 30) = 10
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 7, HOJE, 30)).toBe(10);
  });

  it("vacas em lactação = 0 → null", () => {
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 0, HOJE, 30)).toBeNull();
  });

  it("saída fora do período (mais de 30 dias atrás) é ignorada", () => {
    const antiga = "2026-04-01"; // > 30 dias antes de 2026-06-17
    expect(custoVacaDia([{ valorTotal: 2100, data: antiga }], 7, HOJE, 30)).toBe(0);
  });
});
