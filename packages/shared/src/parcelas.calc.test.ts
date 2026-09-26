import { describe, expect, it } from "vitest";
import { gerarParcelasFinanceiras, simularParcelas, totalItensFinanceiros } from "./parcelas.calc.js";

describe("parcelas financeiras", () => {
  it("arredonda cada item antes de somar", () => {
    expect(totalItensFinanceiros([{ quantidade: "0.335", valorUnitario: "1.00" }, { quantidade: "0.335", valorUnitario: "1.00" }])).toBe(0.68);
  });

  it("divide centavos, sobra nas primeiras e mantém o dia após fevereiro", () => {
    expect(gerarParcelasFinanceiras("100.00", 3, "MENSAL", "2026-01-31")).toEqual([
      { valor: 33.34, dataVencimento: "2026-01-31" }, { valor: 33.33, dataVencimento: "2026-02-28" }, { valor: 33.33, dataVencimento: "2026-03-31" },
    ]);
  });

  it("semanal soma 7 dias", () => {
    expect(gerarParcelasFinanceiras(0.02, 2, "SEMANAL", "2026-12-28").map((p) => p.dataVencimento)).toEqual(["2026-12-28", "2027-01-04"]);
  });

  it.each([
    [100, 0, "2026-01-01", "quantidadeParcelas"],
    [0.02, 3, "2026-01-01", "quantidadeParcelas"],
    [100, 361, "2026-01-01", "quantidadeParcelas"],
    [100, 1, "2026-02-30", "primeiroVencimento"],
    [100, 1, "01/02/2026", "primeiroVencimento"],
  ])("recusa total %s em %s parcelas a partir de %s", (total, quantidade, data, campo) => {
    expect(() => gerarParcelasFinanceiras(total, quantidade, "MENSAL", data)).toThrow(expect.objectContaining({ campo }));
  });

  it("simula pelo total dos itens descontando o pago agora", () => {
    const r = simularParcelas({ itens: [{ quantidade: 0.335, valorUnitario: 1 }, { quantidade: 3, valorTotal: 100.005 }], valorPagoAgora: 0.1, quantidadeParcelas: 3, frequencia: "SEMANAL", primeiroVencimento: "2026-01-31" });
    expect(r).toEqual({
      totalOperacao: 100.35, valorPagoAgora: 0.1, saldoAPrazo: 100.25,
      parcelas: [{ valor: 33.42, dataVencimento: "2026-01-31" }, { valor: 33.42, dataVencimento: "2026-02-07" }, { valor: 33.41, dataVencimento: "2026-02-14" }],
    });
  });

  it("saldo a prazo zerado é recusado", () => {
    expect(() => simularParcelas({ itens: [], valorTotal: 100, valorPagoAgora: 100, quantidadeParcelas: 1, frequencia: "MENSAL", primeiroVencimento: "2026-10-01" }))
      .toThrow(expect.objectContaining({ message: "O saldo a prazo deve ser maior que zero", campo: "valorPagoAgora" }));
  });
});
