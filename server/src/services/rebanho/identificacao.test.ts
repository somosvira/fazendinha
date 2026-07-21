import { describe, expect, it } from "vitest";
import { mencaoAnimal, rotuloAnimal } from "./identificacao.js";

describe("identificação textual canônica do animal", () => {
  it("preserva zeros à esquerda e prioriza o número em rótulos", () => {
    expect(rotuloAnimal("0942", "Jurema")).toBe("#0942 · Jurema");
  });

  it("prioriza o número em frases sem inventar nome", () => {
    expect(mencaoAnimal("0942", "Jurema")).toBe("#0942 Jurema");
    expect(mencaoAnimal("0942", null)).toBe("#0942");
    expect(mencaoAnimal("0942", "   ")).toBe("#0942");
  });
});
