import { describe, expect, it } from "vitest";
import { agruparQuantitativo, FAIXAS, type AnimalQuant } from "./quantitativo.calc.js";

const HOJE = "2026-07-20";
// dataNascimento tal que a idade cai na faixa desejada em 2026-07-20:
const a = (categoria: string, dataNascimento: string | null): AnimalQuant => ({ categoria, dataNascimento });

describe("agruparQuantitativo", () => {
  it("vazio → total 0, matriz vazia", () => {
    const r = agruparQuantitativo([], HOJE);
    expect(r.total).toBe(0);
    expect(r.linhas).toEqual([]);
  });

  it("classifica por faixa etária correta", () => {
    const r = agruparQuantitativo([
      a("BEZERRA", "2026-05-01"),   // ~2.5m → 0-6
      a("NOVILHA", "2025-01-01"),   // ~18m → 12-24
      a("VACA", "2022-01-01"),      // ~54m → 36+
      a("VACA", null),              // sem idade
    ], HOJE);
    const bez = r.linhas.find((l) => l.categoria === "BEZERRA")!;
    expect(bez.faixas["0-6"]).toBe(1);
    const nov = r.linhas.find((l) => l.categoria === "NOVILHA")!;
    expect(nov.faixas["12-24"]).toBe(1);
    const vaca = r.linhas.find((l) => l.categoria === "VACA")!;
    expect(vaca.faixas["36+"]).toBe(1);
    expect(vaca.faixas["sem-idade"]).toBe(1);
  });

  it("totais por categoria e por faixa e geral batem", () => {
    const r = agruparQuantitativo([a("VACA", "2020-01-01"), a("VACA", "2019-01-01"), a("NOVILHA", "2025-01-01")], HOJE);
    expect(r.total).toBe(3);
    expect(r.linhas.find((l) => l.categoria === "VACA")!.totalCategoria).toBe(2);
    expect(r.totalPorFaixa["36+"]).toBe(2); // as duas vacas
    expect(r.totalPorFaixa["12-24"]).toBe(1); // a novilha
  });

  it("linhas ordenadas por total de categoria desc", () => {
    const r = agruparQuantitativo([a("VACA", null), a("VACA", null), a("NOVILHA", null)], HOJE);
    expect(r.linhas.map((l) => l.categoria)).toEqual(["VACA", "NOVILHA"]);
  });

  it("expõe a ordem de faixas", () => {
    expect(FAIXAS).toEqual(["0-6", "6-12", "12-24", "24-36", "36+", "sem-idade"]);
  });
});
