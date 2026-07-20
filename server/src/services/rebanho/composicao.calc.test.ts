import { describe, expect, it } from "vitest";
import { derivarComposicao, type PrincipioComposicao } from "./composicao.calc.js";

const p = (nome: string, ehAntibiotico: boolean, carenciaLeiteHoras: number | null = null, carenciaCarneDias: number | null = null): PrincipioComposicao =>
  ({ nome, ehAntibiotico, carenciaLeiteHoras, carenciaCarneDias });

describe("derivarComposicao", () => {
  it("produto sem princípios → não é antibiótico, sem carência sugerida", () => {
    const r = derivarComposicao([]);
    expect(r).toEqual({ ehAntibiotico: false, carenciaLeiteHorasSugerida: null, carenciaCarneDiasSugerida: null, principios: [] });
  });

  it("é antibiótico se QUALQUER princípio for antibiótico", () => {
    expect(derivarComposicao([p("Vitamina", false), p("Amoxicilina", true)]).ehAntibiotico).toBe(true);
    expect(derivarComposicao([p("Vitamina", false)]).ehAntibiotico).toBe(false);
  });

  it("carência sugerida = MÁXIMO entre os princípios (o mais restritivo manda)", () => {
    const r = derivarComposicao([
      p("A", true, 72, 21),
      p("B", true, 96, 14),
      p("C", false, null, null),
    ]);
    expect(r.carenciaLeiteHorasSugerida).toBe(96);
    expect(r.carenciaCarneDiasSugerida).toBe(21);
  });

  it("ignora nulos ao calcular o máximo", () => {
    const r = derivarComposicao([p("A", true, null, 30), p("B", true, 48, null)]);
    expect(r.carenciaLeiteHorasSugerida).toBe(48);
    expect(r.carenciaCarneDiasSugerida).toBe(30);
  });

  it("carência null quando nenhum princípio informa carência", () => {
    const r = derivarComposicao([p("A", true, null, null)]);
    expect(r.carenciaLeiteHorasSugerida).toBeNull();
    expect(r.carenciaCarneDiasSugerida).toBeNull();
  });

  it("devolve os nomes dos princípios na ordem de entrada", () => {
    const r = derivarComposicao([p("Amoxicilina", true), p("Ácido clavulânico", true)]);
    expect(r.principios).toEqual(["Amoxicilina", "Ácido clavulânico"]);
  });
});
