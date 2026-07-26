import { describe, expect, it } from "vitest";
import { alternarExcecaoAnimal, rotuloResumoEtapa } from "./iatf-lote";

describe("alternarExcecaoAnimal", () => {
  it("adiciona animal normalizando ordem e sem duplicar", () => {
    expect(alternarExcecaoAnimal([103, 101], 102, true)).toEqual([101, 102, 103]);
    expect(alternarExcecaoAnimal([101, 102], 102, true)).toEqual([101, 102]);
  });

  it("remove animal quando deixa de ser exceção", () => {
    expect(alternarExcecaoAnimal([101, 102], 101, false)).toEqual([102]);
  });
});

describe("rotuloResumoEtapa", () => {
  it("resume status reais e destaca atraso", () => {
    expect(rotuloResumoEtapa({ dia: 7, ordem: 0, concluidas: 8, puladas: 1, pendentes: 3, atrasadas: 2 }))
      .toBe("8 feitas · 1 pulada · 3 pendentes · 2 atrasadas");
  });

  it("usa plural correto", () => {
    expect(rotuloResumoEtapa({ dia: 0, ordem: 0, concluidas: 1, puladas: 0, pendentes: 1, atrasadas: 0 }))
      .toBe("1 feita · 1 pendente");
  });
});
