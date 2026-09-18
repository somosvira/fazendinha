import { describe, expect, it } from "vitest";
import { gerarParcelas } from "./parcelas";

describe("gerarParcelas", () => {
  it("fecha os centavos sem usar ponto flutuante", () => expect(gerarParcelas("100.00", 3, "MENSAL", "2026-01-31")).toEqual([
    { valor: "33.34", vencimento: "2026-01-31" }, { valor: "33.33", vencimento: "2026-02-28" }, { valor: "33.33", vencimento: "2026-03-31" },
  ]));
  it("gera intervalos semanais", () => expect(gerarParcelas("75", 3, "SEMANAL", "2026-12-28").map((p) => p.vencimento)).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]));
});
