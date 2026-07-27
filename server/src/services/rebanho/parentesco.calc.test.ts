import { describe, expect, it } from "vitest";
import {
  coeficienteParentesco,
  normalizarChaveGenealogica,
  pedigreeVerificavel,
  type Ancestral,
  type Genealogia,
} from "./parentesco.calc.js";

function genealogia(
  ancestrais: Ancestral[],
  opcoes: Partial<Omit<Genealogia, "ancestrais">> = {},
): Genealogia {
  return {
    ancestrais,
    profundidade: 1,
    paiConhecido: true,
    ...opcoes,
  };
}

describe("normalizarChaveGenealogica", () => {
  it("normaliza sem diferenciar maiúsculas, acentos ou espaços", () => {
    expect(normalizarChaveGenealogica(" Avô Átlas  ")).toBe("avoatlas");
    expect(normalizarChaveGenealogica(null)).toBe("");
    expect(normalizarChaveGenealogica(undefined)).toBe("");
  });
});

describe("coeficienteParentesco", () => {
  it("calcula 0,25 quando a fêmea e o touro compartilham o pai", () => {
    const femea = genealogia([{ chave: "Pai comum", grau: 0.5 }]);
    const touro = genealogia([{ chave: "PAI COMUM", grau: 0.5 }]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.25);
  });

  it("calcula 0,0625 quando a fêmea e o touro compartilham um avô", () => {
    const femea = genealogia([{ chave: "Avô comum", grau: 0.25 }]);
    const touro = genealogia([{ chave: "Avo Comum", grau: 0.25 }]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.0625);
  });

  it("soma as contribuições de duas chaves compartilhadas", () => {
    const femea = genealogia([
      { chave: "Pai A", grau: 0.5 },
      { chave: "Avó B", grau: 0.25 },
    ]);
    const touro = genealogia([
      { chave: "pai a", grau: 0.5 },
      { chave: "avo b", grau: 0.25 },
    ]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.3125);
  });

  it("soma graus de caminhos repetidos antes de calcular o produto", () => {
    const femea = genealogia([
      { chave: "Atlas", grau: 0.5 },
      { chave: "ÁTLAS", grau: 0.25 },
    ]);
    const touro = genealogia([
      { chave: "atlas", grau: 0.5 },
      { chave: "At las", grau: 0.25 },
    ]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.5625);
  });

  it("retorna zero quando não há ancestral comum conhecido", () => {
    const femea = genealogia([{ chave: "Atlas", grau: 0.5 }]);
    const touro = genealogia([{ chave: "Bento", grau: 0.5 }]);

    expect(coeficienteParentesco(femea, touro)).toBe(0);
  });

  it("ignora chaves vazias e graus não positivos ou não finitos", () => {
    const femea = genealogia([
      { chave: "Atlas", grau: 0.5 },
      { chave: "   ", grau: 10 },
      { chave: "Bento", grau: 0 },
      { chave: "César", grau: -0.5 },
      { chave: "Dante", grau: Number.NaN },
      { chave: "Eros", grau: Number.POSITIVE_INFINITY },
    ]);
    const touro = genealogia([
      { chave: "Atlas", grau: 0.5 },
      { chave: "", grau: 10 },
      { chave: "Bento", grau: 1 },
      { chave: "César", grau: 1 },
      { chave: "Dante", grau: 1 },
      { chave: "Eros", grau: 1 },
    ]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.25);
  });

  it("limita o coeficiente máximo a um", () => {
    const femea = genealogia([{ chave: "Atlas", grau: 2 }]);
    const touro = genealogia([{ chave: "Atlas", grau: 2 }]);

    expect(coeficienteParentesco(femea, touro)).toBe(1);
  });

  it("arredonda o coeficiente a seis casas decimais", () => {
    const femea = genealogia([{ chave: "Atlas", grau: 0.3333333 }]);
    const touro = genealogia([{ chave: "Atlas", grau: 0.3333333 }]);

    expect(coeficienteParentesco(femea, touro)).toBe(0.111111);
  });

  it("não muta os arrays nem os ancestrais de entrada", () => {
    const ancestraisFemea = [
      { chave: "  Átlas ", grau: 0.5 },
      { chave: "Atlas", grau: 0.25 },
    ];
    const ancestraisTouro = [{ chave: "ATLAS", grau: 0.5 }];
    const estadoInicialFemea = structuredClone(ancestraisFemea);
    const estadoInicialTouro = structuredClone(ancestraisTouro);

    coeficienteParentesco(
      genealogia(ancestraisFemea),
      genealogia(ancestraisTouro),
    );

    expect(ancestraisFemea).toEqual(estadoInicialFemea);
    expect(ancestraisTouro).toEqual(estadoInicialTouro);
  });
});

describe("pedigreeVerificavel", () => {
  it("exige pai conhecido, profundidade e ancestral válido nos dois lados", () => {
    const valido = genealogia([{ chave: "Atlas", grau: 0.5 }]);
    const semPai = genealogia([{ chave: "Atlas", grau: 0.5 }], {
      paiConhecido: false,
    });
    const semProfundidade = genealogia([{ chave: "Atlas", grau: 0.5 }], {
      profundidade: 0,
    });
    const semAncestralValido = genealogia([
      { chave: "   ", grau: 0.5 },
      { chave: "Atlas", grau: Number.NaN },
    ]);

    expect(pedigreeVerificavel(valido, valido)).toBe(true);
    expect(pedigreeVerificavel(semPai, valido)).toBe(false);
    expect(pedigreeVerificavel(valido, semPai)).toBe(false);
    expect(pedigreeVerificavel(semProfundidade, valido)).toBe(false);
    expect(pedigreeVerificavel(valido, semProfundidade)).toBe(false);
    expect(pedigreeVerificavel(semAncestralValido, valido)).toBe(false);
    expect(pedigreeVerificavel(valido, semAncestralValido)).toBe(false);
  });
});
