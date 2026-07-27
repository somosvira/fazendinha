import { describe, expect, it } from "vitest";
import {
  configDaCombinacao,
  configDefault,
  type MedidaResolvida,
} from "./config-acasalamento.calc.js";

function medida(overrides: Partial<MedidaResolvida>): MedidaResolvida {
  return {
    tipo: "MERITO",
    peso: 1,
    obrigatoria: false,
    consanguinidadeMax: null,
    exigePedigree: false,
    itens: [],
    ...overrides,
  };
}

describe("configDaCombinacao", () => {
  it("combina pesos e direções e resolve restrições, consanguinidade e pedigree", () => {
    const medidas = [
      medida({
        tipo: "MERITO",
        peso: 2,
        obrigatoria: true,
        itens: [{ indicadorId: 11, peso: 1.5, minimo: null, maximo: null }],
      }),
      medida({
        tipo: "RESTRICAO_INDICADOR",
        peso: 0.5,
        itens: [{ indicadorId: 12, peso: 4, minimo: 10, maximo: 20 }],
      }),
      medida({ tipo: "CONSANGUINIDADE", consanguinidadeMax: 0.25 }),
      medida({ tipo: "CONSANGUINIDADE", consanguinidadeMax: 0.125 }),
      medida({ tipo: "PEDIGREE", exigePedigree: true }),
    ] satisfies MedidaResolvida[];
    const original = structuredClone(medidas);

    expect(configDaCombinacao(medidas, new Map([
      [11, "maior_melhor"],
      [12, "menor_melhor"],
    ]))).toEqual({
      termos: [
        {
          indicadorId: 11,
          peso: 3,
          direcao: "maior_melhor",
          minimo: null,
          maximo: null,
          obrigatoria: true,
        },
        {
          indicadorId: 12,
          peso: 2,
          direcao: "menor_melhor",
          minimo: 10,
          maximo: 20,
          obrigatoria: true,
        },
      ],
      consanguinidadeMax: 0.125,
      exigePedigree: true,
    });
    expect(medidas).toEqual(original);
  });

  it("usa limiar permissivo quando não há medida de consanguinidade", () => {
    expect(configDaCombinacao([], new Map())).toEqual({
      termos: [],
      consanguinidadeMax: 1,
      exigePedigree: false,
    });
  });

  it("falha quando um indicador referenciado não tem direção conhecida", () => {
    const medidas = [medida({
      itens: [{ indicadorId: 99, peso: 1, minimo: null, maximo: null }],
    })];

    expect(() => configDaCombinacao(medidas, new Map())).toThrow(
      "indicador 99 sem direção configurada",
    );
  });

  it("rejeita limiar não finito", () => {
    const medidas = [medida({
      tipo: "CONSANGUINIDADE",
      consanguinidadeMax: Number.NaN,
    })];

    expect(() => configDaCombinacao(medidas, new Map())).toThrow(
      "limite de consanguinidade inválido",
    );
  });
});

describe("configDefault", () => {
  it("usa apenas indicadores de ranking com peso unitário e limiar retrocompatível", () => {
    const ranking = [
      { indicadorId: 3, direcao: "menor_melhor" as const },
      { indicadorId: 8, direcao: "maior_melhor" as const },
    ];

    expect(configDefault(ranking)).toEqual({
      termos: [
        {
          indicadorId: 3,
          peso: 1,
          direcao: "menor_melhor",
          minimo: null,
          maximo: null,
          obrigatoria: false,
        },
        {
          indicadorId: 8,
          peso: 1,
          direcao: "maior_melhor",
          minimo: null,
          maximo: null,
          obrigatoria: false,
        },
      ],
      consanguinidadeMax: 0.125,
      exigePedigree: false,
    });
    expect(ranking).toEqual([
      { indicadorId: 3, direcao: "menor_melhor" },
      { indicadorId: 8, direcao: "maior_melhor" },
    ]);
  });
});
