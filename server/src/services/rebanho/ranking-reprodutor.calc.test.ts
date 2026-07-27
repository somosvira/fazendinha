import { describe, expect, it } from "vitest";
import { ranquearPorIndicador } from "./ranking-reprodutor.calc.js";

const rep = (id: number, valorIndicador: number | null) => ({ id, valorIndicador });

describe("ranquearPorIndicador", () => {
  it("maior_melhor ordena desc e joga ausentes para o fim", () => {
    expect(
      ranquearPorIndicador(
        [rep(1, 10), rep(2, null), rep(3, 30)],
        "maior_melhor",
      ).map((r) => r.id),
    ).toEqual([3, 1, 2]);
  });

  it("menor_melhor ordena asc e joga ausentes para o fim", () => {
    expect(
      ranquearPorIndicador(
        [rep(1, 10), rep(2, null), rep(3, 30)],
        "menor_melhor",
      ).map((r) => r.id),
    ).toEqual([1, 3, 2]);
  });

  it("desempata por id quando os valores empatam", () => {
    expect(
      ranquearPorIndicador(
        [rep(5, 10), rep(2, 10)],
        "maior_melhor",
      ).map((r) => r.id),
    ).toEqual([2, 5]);
  });
});
