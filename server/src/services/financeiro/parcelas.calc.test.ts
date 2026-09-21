import { describe, expect, it } from "vitest";
import { gerarParcelasFinanceiras, totalItensFinanceiros } from "./parcelas.calc.js";

describe("parcelas financeiras", () => {
  it("repete o arredondamento por item usado na confirmação", () => {
    expect(totalItensFinanceiros([{ quantidade: "0.335", valorUnitario: "1.00" }, { quantidade: "0.335", valorUnitario: "1.00" }]).toString()).toBe("0.68");
  });

  it("divide centavos e mantém o dia original após fevereiro", () => {
    expect(gerarParcelasFinanceiras("100.00", 3, "MENSAL", "2026-01-31").map((parcela) => ({ valor: parcela.valor.toString(), data: parcela.dataVencimento }))).toEqual([
      { valor: "33.34", data: "2026-01-31" }, { valor: "33.33", data: "2026-02-28" }, { valor: "33.33", data: "2026-03-31" },
    ]);
  });
});
