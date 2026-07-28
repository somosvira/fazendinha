import { describe, expect, it } from "vitest";
import { coeficienteParentesco, pedigreeVerificavel } from "./parentesco.calc.js";
import {
  genealogiaDaFemea,
  genealogiaDoTouro,
  type AnimalGenealogia,
  type PedigreeGenealogia,
} from "./genealogia-acasalamento.calc.js";

function animal(overrides: Partial<AnimalGenealogia> = {}): AnimalGenealogia {
  return {
    paiNome: null,
    pai: null,
    mae: null,
    ...overrides,
  };
}

function pedigree(overrides: Partial<PedigreeGenealogia> = {}): PedigreeGenealogia {
  return {
    paiNome: null,
    paiCodigo: null,
    maeNome: null,
    maeCodigo: null,
    avoMaternoNome: null,
    avoMaternoCodigo: null,
    avoPaternoNome: null,
    avoPaternoCodigo: null,
    ...overrides,
  };
}

describe("genealogiaDaFemea", () => {
  it("prioriza números dos pais e avós estruturados com os graus corretos", () => {
    const resultado = genealogiaDaFemea(animal({
      paiNome: "Pai textual ignorado",
      pai: {
        numero: "P-001",
        nome: "Pai estruturado",
        paiNome: "Avô paterno textual",
        mae: { numero: "AP-002", nome: "Avó paterna" },
      },
      mae: {
        numero: "M-001",
        nome: "Mãe estruturada",
        paiNome: "AM-001",
        mae: { numero: "AM-002", nome: "Avó materna" },
      },
    }));

    expect(resultado).toEqual({
      ancestrais: [
        { chave: "P-001", grau: 0.5 },
        { chave: "M-001", grau: 0.5 },
        { chave: "Avô paterno textual", grau: 0.25 },
        { chave: "AP-002", grau: 0.25 },
        { chave: "AM-001", grau: 0.25 },
        { chave: "AM-002", grau: 0.25 },
      ],
      profundidade: 2,
      paiConhecido: true,
    });
  });

  it("usa paiNome textual quando não há pai estruturado", () => {
    expect(genealogiaDaFemea(animal({ paiNome: "  Touro Alpha  " }))).toEqual({
      ancestrais: [{ chave: "  Touro Alpha  ", grau: 0.5 }],
      profundidade: 1,
      paiConhecido: true,
    });
  });
});

describe("genealogiaDoTouro", () => {
  it("inclui aliases do próprio touro e uma chave por ancestral do pedigree", () => {
    const resultado = genealogiaDoTouro(pedigree({
      paiNome: "Pai por nome",
      paiCodigo: "PAI-01",
      maeNome: "Mãe por nome",
      maeCodigo: "MAE-01",
      avoMaternoNome: "Avô materno",
      avoMaternoCodigo: "AM-01",
      avoPaternoNome: "Avô paterno",
      avoPaternoCodigo: null,
    }), "Touro próprio", "TOURO-01");

    expect(resultado).toEqual({
      ancestrais: [
        { chave: "TOURO-01", grau: 1 },
        { chave: "Touro próprio", grau: 1 },
        { chave: "PAI-01", grau: 0.5 },
        { chave: "MAE-01", grau: 0.5 },
        { chave: "AM-01", grau: 0.25 },
        { chave: "Avô paterno", grau: 0.25 },
      ],
      profundidade: 2,
      paiConhecido: true,
    });
  });

  it("não torna o pedigree verificável apenas com a identidade do touro", () => {
    const femea = genealogiaDaFemea(animal({ paiNome: "Outro pai" }));
    const touro = genealogiaDoTouro(null, "Touro sem pedigree", "TS-01");

    expect(touro).toEqual({
      ancestrais: [
        { chave: "TS-01", grau: 1 },
        { chave: "Touro sem pedigree", grau: 1 },
      ],
      profundidade: 0,
      paiConhecido: false,
    });
    expect(pedigreeVerificavel(femea, touro)).toBe(false);
  });

  it("detecta parentesco direto pelo código do próprio touro", () => {
    const femea = genealogiaDaFemea(animal({ paiNome: " touro-compat " }));
    const touro = genealogiaDoTouro(null, "Outro nome", "TOURO-COMPAT");

    expect(coeficienteParentesco(femea, touro)).toBe(0.5);
  });

  it("detecta parentesco direto pelo nome mesmo quando o touro tem código distinto", () => {
    const femea = genealogiaDaFemea(animal({ paiNome: "BARTOLOMEU" }));
    const touro = genealogiaDoTouro(null, "Bartolomeu", "HOL123");

    expect(coeficienteParentesco(femea, touro)).toBe(0.5);
  });

  it("não duplica aliases do touro que normalizam para a mesma chave", () => {
    const touro = genealogiaDoTouro(null, " HOL 123 ", "HOL123");

    expect(touro.ancestrais).toEqual([{ chave: "HOL123", grau: 1 }]);
  });
});
