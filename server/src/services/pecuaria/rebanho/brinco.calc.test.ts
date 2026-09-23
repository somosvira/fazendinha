import { describe, expect, it } from "vitest";
import { brincoDisponivel, normalizarBrinco } from "./brinco.calc.js";

describe("normalizarBrinco", () => {
  it("remove espaços nas pontas, maiusculiza e colapsa espaços internos", () => {
    expect(normalizarBrinco("  ab   12 ")).toBe("AB 12");
  });
});

describe("brincoDisponivel", () => {
  const ativos = [
    { brinco: "001", propriedadeId: 1, animalId: "a1" },
    { brinco: "002", propriedadeId: 2, animalId: "a2" },
  ];

  it("bloqueia brinco repetido no mesmo sítio entre animais ativos", () => {
    expect(brincoDisponivel({ brinco: "001", propriedadeId: 1, ativosNoSitio: ativos })).toBe(false);
  });

  it("permite brinco repetido em outro sítio", () => {
    expect(brincoDisponivel({ brinco: "002", propriedadeId: 1, ativosNoSitio: ativos })).toBe(true);
  });

  it("ignora comparação com o próprio animal (edição)", () => {
    expect(brincoDisponivel({ brinco: "001", propriedadeId: 1, ativosNoSitio: ativos, ignorarAnimalId: "a1" })).toBe(true);
  });

  it("permite reuso de brinco de animal já saído (não está na lista de ativos)", () => {
    const semOAnimalSaido = ativos.filter((a) => a.animalId !== "a1");
    expect(brincoDisponivel({ brinco: "001", propriedadeId: 1, ativosNoSitio: semOAnimalSaido })).toBe(true);
  });

  it("normaliza antes de comparar (case/espacos)", () => {
    expect(brincoDisponivel({ brinco: " 001 ", propriedadeId: 1, ativosNoSitio: ativos })).toBe(false);
  });
});
