import { expect, it } from "vitest";
import { preSelecionarOrigensGerais } from "./origens-automaticas.calc.js";
import type { AnimalContextoLeite, LactacaoContextoLeite } from "./populacao.calc.js";

const data = new Date("2026-10-23");
const animal: AnimalContextoLeite = {
  id: "a", sexo: "F", nome: "Aurora", brinco: "103",
  dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2021-01-01"),
  destinos: [{ id: "f", aptidao: "LEITE", desde: new Date("2021-01-01"), ate: null }],
  localizacoes: [{ id: "l", propriedadeId: 1, desde: new Date("2021-01-01"), ate: null }],
  baixas: [],
};
const lactacao: LactacaoContextoLeite = { id: "lac", animalId: "a", inicio: new Date("2026-10-20"), encerradaEm: null };

it("pré-seleciona finalidade Leite e DEL positivo na data, sem depender do controle individual", () => {
  expect(preSelecionarOrigensGerais([animal], [lactacao], 1, data)).toEqual([
    { animalId: "a", brinco: "103", nome: "Aurora", del: 3 },
  ]);
});
it.each(["CORTE", "REPRODUCAO"] as const)("não inclui finalidade %s, lacuna ou conflito histórico", tipo => {
  expect(preSelecionarOrigensGerais([{ ...animal, destinos: [{ ...animal.destinos[0], aptidao: tipo }] }], [lactacao], 1, data)).toEqual([]);
  expect(preSelecionarOrigensGerais([{ ...animal, destinos: [] }], [lactacao], 1, data)).toEqual([]);
  expect(preSelecionarOrigensGerais([{ ...animal, destinos: [...animal.destinos, { ...animal.destinos[0], id: "outra" }] }], [lactacao], 1, data)).toEqual([]);
});
it("não presume DEL quando a lactação está ausente, futura, encerrada ou sobreposta; D0 fica fora", () => {
  for (const lactacoes of [[], [{ ...lactacao, inicio: data }], [{ ...lactacao, inicio: new Date("2026-10-24") }], [{ ...lactacao, encerradaEm: data }], [lactacao, { ...lactacao, id: "outra" }]]) {
    expect(preSelecionarOrigensGerais([animal], lactacoes, 1, data)).toEqual([]);
  }
});
it("respeita finalidade histórica, sítio, entrada e sexo", () => {
  const historico = [{ ...animal.destinos[0], ate: new Date("2026-10-24") }, { ...animal.destinos[0], id: "nova", aptidao: "REPRODUCAO", desde: new Date("2026-10-24") }];
  expect(preSelecionarOrigensGerais([{ ...animal, destinos: historico }], [lactacao], 1, data)).toHaveLength(1);
  expect(preSelecionarOrigensGerais([{ ...animal, destinos: historico }], [lactacao], 1, new Date("2026-10-24"))).toEqual([]);
  expect(preSelecionarOrigensGerais([animal], [lactacao], 2, data)).toEqual([]);
  expect(preSelecionarOrigensGerais([{ ...animal, dataEntrada: new Date("2026-10-24") }], [lactacao], 1, data)).toEqual([]);
  expect(preSelecionarOrigensGerais([{ ...animal, sexo: "M" }], [lactacao], 1, data)).toEqual([]);
});
