import { describe, it, expect } from "vitest";
import { projetarColunasLegadas, type IndicadorEspelho } from "./genetica-espelho.calc.js";

const cat = new Map<number, IndicadorEspelho>([
  [1, { id: 1, colunaLegada: "ptaLeite" }],
  [2, { id: 2, colunaLegada: "ptaGordura" }],
  [3, { id: 3, colunaLegada: "ptaProteina" }],
  [4, { id: 4, colunaLegada: "tpi" }],
  [5, { id: 5, colunaLegada: null }], // indicador sem coluna → ignorado
]);

describe("projetarColunasLegadas", () => {
  it("projeta cada coluna conhecida a partir do indicador com colunaLegada", () => {
    const proj = projetarColunasLegadas(
      [{ indicadorId: 1, valor: 900 }, { indicadorId: 2, valor: 42.5 }, { indicadorId: 3, valor: 30 }, { indicadorId: 4, valor: 2800 }],
      cat,
    );
    expect(proj).toEqual({ ptaLeite: 900, ptaGordura: 42.5, ptaProteina: 30, tpi: 2800 });
  });
  it("ignora indicador sem colunaLegada e indicador ausente do catálogo", () => {
    expect(projetarColunasLegadas([{ indicadorId: 5, valor: 99 }, { indicadorId: 99, valor: 1 }], cat)).toEqual({});
  });
});
