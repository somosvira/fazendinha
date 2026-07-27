import { describe, expect, it } from "vitest";
import {
  calcularMeritos,
  type CandidatoMerito,
  type TermoMedida,
} from "./merito-acasalamento.calc.js";

function termo(
  indicadorId: number,
  opcoes: Partial<Omit<TermoMedida, "indicadorId">> = {},
): TermoMedida {
  return {
    indicadorId,
    peso: 1,
    direcao: "maior_melhor",
    minimo: null,
    maximo: null,
    ...opcoes,
  };
}

describe("calcularMeritos", () => {
  it("normaliza um indicador maior_melhor entre zero e um", () => {
    const resultados = calcularMeritos(
      [
        { id: 1, valores: [{ indicadorId: 10, valor: 20 }] },
        { id: 2, valores: [{ indicadorId: 10, valor: 30 }] },
      ],
      [termo(10)],
    );

    expect(resultados).toEqual([
      {
        candidatoId: 1,
        merito: 0,
        indicadoresPontuados: 1,
        violacoes: [],
      },
      {
        candidatoId: 2,
        merito: 1,
        indicadoresPontuados: 1,
        violacoes: [],
      },
    ]);
  });

  it("inverte a normalização para um indicador menor_melhor", () => {
    const resultados = calcularMeritos(
      [
        { id: 1, valores: [{ indicadorId: 10, valor: 20 }] },
        { id: 2, valores: [{ indicadorId: 10, valor: 30 }] },
      ],
      [termo(10, { direcao: "menor_melhor" })],
    );

    expect(resultados.map(({ merito }) => merito)).toEqual([1, 0]);
  });

  it("aplica os pesos à média e arredonda o mérito a seis casas", () => {
    const resultados = calcularMeritos(
      [
        {
          id: 1,
          valores: [
            { indicadorId: 10, valor: 10 },
            { indicadorId: 20, valor: 0 },
          ],
        },
        {
          id: 2,
          valores: [
            { indicadorId: 10, valor: 0 },
            { indicadorId: 20, valor: 10 },
          ],
        },
      ],
      [termo(10, { peso: 2 }), termo(20)],
    );

    expect(resultados.map(({ merito }) => merito)).toEqual([
      0.666667, 0.333333,
    ]);
  });

  it("atribui 0,5 quando todos os valores do indicador são iguais", () => {
    const resultados = calcularMeritos(
      [
        { id: 1, valores: [{ indicadorId: 10, valor: 25 }] },
        { id: 2, valores: [{ indicadorId: 10, valor: 25 }] },
      ],
      [termo(10)],
    );

    expect(resultados.map(({ merito }) => merito)).toEqual([0.5, 0.5]);
  });

  it("não penaliza indicador ausente e usa apenas os pesos disponíveis", () => {
    const resultados = calcularMeritos(
      [
        { id: 1, valores: [{ indicadorId: 10, valor: 10 }] },
        {
          id: 2,
          valores: [
            { indicadorId: 10, valor: 0 },
            { indicadorId: 20, valor: 20 },
          ],
        },
        { id: 3, valores: [{ indicadorId: 20, valor: 0 }] },
        { id: 4, valores: [{ indicadorId: 10, valor: null }] },
      ],
      [termo(10), termo(20)],
    );

    expect(
      resultados.map(({ merito, indicadoresPontuados }) => ({
        merito,
        indicadoresPontuados,
      })),
    ).toEqual([
      { merito: 1, indicadoresPontuados: 1 },
      { merito: 0.5, indicadoresPontuados: 2 },
      { merito: 0, indicadoresPontuados: 1 },
      { merito: 0, indicadoresPontuados: 0 },
    ]);
  });

  it("aceita limites inclusivos e lista violações na ordem consolidada", () => {
    const resultados = calcularMeritos(
      [
        {
          id: 1,
          valores: [
            { indicadorId: 20, valor: 10 },
            { indicadorId: 10, valor: 20 },
          ],
        },
        {
          id: 2,
          valores: [
            { indicadorId: 20, valor: 9 },
            { indicadorId: 10, valor: 21 },
          ],
        },
      ],
      [
        termo(20, { minimo: 10, maximo: 20 }),
        termo(10, { minimo: 10, maximo: 20 }),
      ],
    );

    expect(resultados[0]?.violacoes).toEqual([]);
    expect(resultados[1]?.violacoes).toEqual([
      { indicadorId: 20, tipo: "minimo", limite: 10, valor: 9 },
      { indicadorId: 10, tipo: "maximo", limite: 20, valor: 21 },
    ]);
  });

  it("ignora pesos inválidos e valores ausentes, nulos ou não finitos", () => {
    const resultados = calcularMeritos(
      [
        {
          id: 1,
          valores: [
            { indicadorId: 10, valor: 10 },
            { indicadorId: 20, valor: 100 },
          ],
        },
        {
          id: 2,
          valores: [
            { indicadorId: 10, valor: Number.NaN },
            { indicadorId: 20, valor: 0 },
          ],
        },
        {
          id: 3,
          valores: [
            { indicadorId: 10, valor: Number.POSITIVE_INFINITY },
            { indicadorId: 20, valor: Number.NEGATIVE_INFINITY },
          ],
        },
      ],
      [
        termo(10, { minimo: 20, maximo: 30 }),
        termo(20, { peso: 0 }),
        termo(30, { peso: -1 }),
        termo(40, { peso: Number.NaN }),
        termo(50, { peso: Number.POSITIVE_INFINITY }),
      ],
    );

    expect(resultados).toEqual([
      {
        candidatoId: 1,
        merito: 0.5,
        indicadoresPontuados: 1,
        violacoes: [
          { indicadorId: 10, tipo: "minimo", limite: 20, valor: 10 },
        ],
      },
      {
        candidatoId: 2,
        merito: 0,
        indicadoresPontuados: 0,
        violacoes: [],
      },
      {
        candidatoId: 3,
        merito: 0,
        indicadoresPontuados: 0,
        violacoes: [],
      },
    ]);
  });

  it("soma pesos de termos compatíveis e rejeita configurações conflitantes", () => {
    const candidatos: CandidatoMerito[] = [
      {
        id: 1,
        valores: [
          { indicadorId: 10, valor: 10 },
          { indicadorId: 20, valor: 0 },
        ],
      },
      {
        id: 2,
        valores: [
          { indicadorId: 10, valor: 0 },
          { indicadorId: 20, valor: 10 },
        ],
      },
    ];

    const resultados = calcularMeritos(candidatos, [
      termo(10),
      termo(20),
      termo(10, { peso: 2 }),
    ]);

    expect(
      resultados.map(({ merito, indicadoresPontuados }) => ({
        merito,
        indicadoresPontuados,
      })),
    ).toEqual([
      { merito: 0.75, indicadoresPontuados: 2 },
      { merito: 0.25, indicadoresPontuados: 2 },
    ]);

    expect(() =>
      calcularMeritos(candidatos, [
        termo(10),
        termo(10, { direcao: "menor_melhor" }),
      ]),
    ).toThrowError("configuração conflitante para o indicador 10");
    expect(() =>
      calcularMeritos(candidatos, [termo(10), termo(10, { minimo: 0 })]),
    ).toThrowError("configuração conflitante para o indicador 10");
    expect(() =>
      calcularMeritos(candidatos, [termo(10), termo(10, { maximo: 10 })]),
    ).toThrowError("configuração conflitante para o indicador 10");
  });

  it("não muta as entradas e preserva a ordem original dos candidatos", () => {
    const candidatos: CandidatoMerito[] = [
      { id: 30, valores: [{ indicadorId: 10, valor: 2 }] },
      { id: 10, valores: [{ indicadorId: 10, valor: 3 }] },
      { id: 20, valores: [{ indicadorId: 10, valor: 1 }] },
    ];
    const termos: TermoMedida[] = [
      termo(10, { peso: 2 }),
      termo(10, { peso: 3 }),
    ];
    const candidatosAntes = structuredClone(candidatos);
    const termosAntes = structuredClone(termos);

    const resultados = calcularMeritos(candidatos, termos);

    expect(resultados.map(({ candidatoId }) => candidatoId)).toEqual([
      30, 10, 20,
    ]);
    expect(candidatos).toEqual(candidatosAntes);
    expect(termos).toEqual(termosAntes);
  });
});
