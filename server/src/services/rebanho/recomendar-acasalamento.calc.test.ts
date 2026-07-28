import { describe, expect, it } from "vitest";
import type { Genealogia } from "./parentesco.calc.js";
import {
  recomendarAcasalamento,
  type CandidatoAcasalamento,
  type ConfigRecomendacao,
  type TermoRecomendacao,
} from "./recomendar-acasalamento.calc.js";

function genealogia(
  chave: string,
  opcoes: Partial<Omit<Genealogia, "ancestrais">> = {},
): Genealogia {
  return {
    ancestrais: [{ chave, grau: 0.5 }],
    profundidade: 1,
    paiConhecido: true,
    ...opcoes,
  };
}

function candidato(
  id: number,
  valores: CandidatoAcasalamento["valores"],
  opcoes: Partial<Omit<CandidatoAcasalamento, "id" | "valores">> = {},
): CandidatoAcasalamento {
  return {
    id,
    nome: `Touro ${id}`,
    genealogia: genealogia(`ancestral-${id}`),
    valores,
    ...opcoes,
  };
}

function termo(
  indicadorId: number,
  opcoes: Partial<Omit<TermoRecomendacao, "indicadorId">> = {},
): TermoRecomendacao {
  return {
    indicadorId,
    peso: 1,
    direcao: "maior_melhor",
    minimo: null,
    maximo: null,
    obrigatoria: false,
    ...opcoes,
  };
}

function config(
  termos: TermoRecomendacao[],
  opcoes: Partial<Omit<ConfigRecomendacao, "termos">> = {},
): ConfigRecomendacao {
  return {
    termos,
    consanguinidadeMax: 0.125,
    exigePedigree: false,
    ...opcoes,
  };
}

describe("recomendarAcasalamento", () => {
  it("ordena pelo mérito ponderado multi-indicador e preserva o score", () => {
    const resultado = recomendarAcasalamento(
      genealogia("linhagem-femea"),
      [
        candidato(1, [
          { indicadorId: 10, valor: 100 },
          { indicadorId: 20, valor: 100 },
        ]),
        candidato(2, [
          { indicadorId: 10, valor: 80 },
          { indicadorId: 20, valor: 10 },
        ]),
      ],
      config([
        termo(10, { peso: 2 }),
        termo(20, { direcao: "menor_melhor" }),
      ]),
    );

    expect(resultado.map(({ reprodutorId }) => reprodutorId)).toEqual([1, 2]);
    expect(
      resultado.map(({ merito, score, indicadoresPontuados, motivos }) => ({
        merito,
        score,
        indicadoresPontuados,
        motivos,
      })),
    ).toEqual([
      {
        merito: 0.666667,
        score: 0.666667,
        indicadoresPontuados: 2,
        motivos: ["mérito genético calculado com 2 indicadores"],
      },
      {
        merito: 0.333333,
        score: 0.333333,
        indicadoresPontuados: 2,
        motivos: ["mérito genético calculado com 2 indicadores"],
      },
    ]);
  });

  it("prioriza consanguinidade, zera o score e formata percentuais", () => {
    const resultado = recomendarAcasalamento(
      genealogia("pai-comum"),
      [
        candidato(1, [{ indicadorId: 10, valor: 20 }], {
          genealogia: genealogia("pai-comum"),
        }),
      ],
      config([termo(10)]),
    );

    expect(resultado[0]).toEqual({
      reprodutorId: 1,
      nome: "Touro 1",
      merito: 0.5,
      parentesco: 0.25,
      status: "consanguineo",
      score: 0,
      motivos: ["parentesco 25% acima do limite de 12.5%"],
      indicadoresPontuados: 1,
    });
  });

  it("restringe violação obrigatória e mantém preferencial como alerta", () => {
    const resultado = recomendarAcasalamento(
      genealogia("linhagem-femea"),
      [
        candidato(1, [
          { indicadorId: 10, valor: 9 },
          { indicadorId: 20, valor: 21 },
        ]),
        candidato(2, [
          { indicadorId: 10, valor: 10 },
          { indicadorId: 20, valor: 21 },
        ]),
      ],
      config([
        termo(10, { minimo: 10, obrigatoria: true }),
        termo(20, { maximo: 20 }),
      ]),
    );

    expect(resultado.map(({ reprodutorId, status, score, motivos }) => ({
      reprodutorId,
      status,
      score,
      motivos,
    }))).toEqual([
      {
        reprodutorId: 2,
        status: "ok",
        score: 0.75,
        motivos: [
          "mérito genético calculado com 2 indicadores",
          "alerta: indicador 20 acima do máximo 20",
        ],
      },
      {
        reprodutorId: 1,
        status: "restrito",
        score: 0,
        motivos: [
          "indicador 10 abaixo do mínimo 10",
          "alerta: indicador 20 acima do máximo 20",
        ],
      },
    ]);
  });

  it("rebaixa pedigree não verificável apesar do mérito maior e mantém o score", () => {
    const resultado = recomendarAcasalamento(
      genealogia("linhagem-femea"),
      [
        candidato(1, [{ indicadorId: 10, valor: 100 }], {
          genealogia: genealogia("linhagem-1", { paiConhecido: false }),
        }),
        candidato(2, [{ indicadorId: 10, valor: 50 }]),
      ],
      config([termo(10)], { exigePedigree: true }),
    );

    expect(resultado.map(({ reprodutorId, status, score, motivos }) => ({
      reprodutorId,
      status,
      score,
      motivos,
    }))).toEqual([
      {
        reprodutorId: 2,
        status: "ok",
        score: 0,
        motivos: ["mérito genético calculado com 1 indicador"],
      },
      {
        reprodutorId: 1,
        status: "nao_verificavel",
        score: 1,
        motivos: ["pedigree insuficiente para verificar consanguinidade"],
      },
    ]);
  });

  it("explica ausência de indicadores genéticos e mantém score zero", () => {
    const resultado = recomendarAcasalamento(
      genealogia("linhagem-femea"),
      [candidato(1, [])],
      config([termo(10)]),
    );

    expect(resultado[0]).toMatchObject({
      merito: 0,
      score: 0,
      status: "ok",
      indicadoresPontuados: 0,
      motivos: ["sem indicadores genéticos cadastrados"],
    });
  });

  it("aceita parentesco exatamente igual ao limite", () => {
    const resultado = recomendarAcasalamento(
      genealogia("pai-comum"),
      [
        candidato(1, [{ indicadorId: 10, valor: 20 }], {
          genealogia: genealogia("pai-comum"),
        }),
      ],
      config([termo(10)], { consanguinidadeMax: 0.25 }),
    );

    expect(resultado[0]).toMatchObject({
      parentesco: 0.25,
      status: "ok",
      score: 0.5,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    "rejeita limite de consanguinidade inválido: %s",
    (consanguinidadeMax) => {
      expect(() =>
        recomendarAcasalamento(
          genealogia("linhagem-femea"),
          [],
          config([], { consanguinidadeMax }),
        ),
      ).toThrowError("limite de consanguinidade inválido");
    },
  );

  it("desempata por id e não muta fêmea, candidatos nem configuração", () => {
    const femea = genealogia("linhagem-femea");
    const candidatos = [
      candidato(20, [{ indicadorId: 10, valor: 50 }]),
      candidato(10, [{ indicadorId: 10, valor: 50 }]),
    ];
    const configuracao = config([termo(10)]);
    const femeaAntes = structuredClone(femea);
    const candidatosAntes = structuredClone(candidatos);
    const configuracaoAntes = structuredClone(configuracao);

    const resultado = recomendarAcasalamento(femea, candidatos, configuracao);

    expect(resultado.map(({ reprodutorId }) => reprodutorId)).toEqual([10, 20]);
    expect(femea).toEqual(femeaAntes);
    expect(candidatos).toEqual(candidatosAntes);
    expect(configuracao).toEqual(configuracaoAntes);
  });
});
