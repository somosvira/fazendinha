import { describe, expect, it } from "vitest";
import { dataValida, lerLitros, resumirCelulas } from "./modelo";
import type { MedicaoInput } from "./types";
const celula = (
  estado: MedicaoInput["estado"],
  litros: number | null,
): MedicaoInput => ({
  animalId: "a",
  posicaoId: "p",
  estado,
  litros,
  motivo: null,
});
describe("Medições da ordenha", () => {
  it("distingue zero declarado e ausência, sem completar cobertura", () => {
    expect(lerLitros("")).toBeNull();
    expect(lerLitros("0")).toBe(0);
    expect(
      resumirCelulas([celula("MEDIDO", 0), celula("PENDENTE", null)]),
    ).toMatchObject({ litros: 0, medidas: 1, pendentes: 1, completa: false });
    expect(resumirCelulas([celula("PENDENTE", null)]).litros).toBeNull();
  });
  it("conta não ordenhado como resolvido, sem inventar volume", () => {
    expect(resumirCelulas([celula("NAO_ORDENHADO", null)])).toMatchObject({
      litros: null,
      naoOrdenhadas: 1,
      resolvidas: 1,
      medidas: 0,
    });
    expect(resumirCelulas([]).completa).toBe(false);
  });
  it("aceita vírgula e rejeita negativos, expoentes, precisão excessiva e infinito", () => {
    expect(lerLitros("2,125")).toBe(2.125);
    for (const v of ["-1", "1e3", "Infinity", "1,0001", "9.999.999"])
      expect(() => lerLitros(v)).toThrow();
  });
  it("valida datas sem normalizar dias inexistentes", () => {
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
  });
});
