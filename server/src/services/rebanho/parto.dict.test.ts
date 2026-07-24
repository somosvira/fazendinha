import { describe, expect, it } from "vitest";
import {
  derivarCrias,
  ehAborto,
  labelAuxilioParto,
  labelTipoParto,
  normalizarAuxilioParto,
  normalizarTipoParto,
} from "./parto.dict.js";

describe("parto.dict", () => {
  it("normaliza códigos oficiais e legados", () => {
    expect(normalizarTipoParto("1")).toBe("1");
    expect(normalizarTipoParto("normal")).toBe("1");
    expect(normalizarTipoParto("distocia")).toBe("2");
    expect(normalizarTipoParto("aborto")).toBe("3");
    expect(normalizarAuxilioParto("2")).toBe("2");
    expect(normalizarAuxilioParto("cesarea")).toBe("2");
  });

  it("rotula dicionários oficiais", () => {
    expect(labelTipoParto("3")).toBe("Aborto");
    expect(labelTipoParto("7")).toBe("Vivo/Natimorto");
    expect(labelAuxilioParto("2")).toBe("4-Cesariana");
  });

  it("deriva vivos/natimortos a partir do tipo quando não há split", () => {
    expect(derivarCrias("1", 1, null, null)).toEqual({ vivos: 1, natimortos: 0 });
    expect(derivarCrias("4", 2, null, null)).toEqual({ vivos: 0, natimortos: 2 });
    expect(derivarCrias("3", 0, null, null)).toEqual({ vivos: 0, natimortos: 0 });
    expect(derivarCrias("7", 2, 1, 1)).toEqual({ vivos: 1, natimortos: 1 });
    expect(ehAborto("3")).toBe(true);
    expect(ehAborto("1")).toBe(false);
  });
});
