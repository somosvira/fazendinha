import { describe, expect, it } from "vitest";
import fixtureJson from "./fixtures/acasalamento-casos-dourados.json";
import type { Genealogia } from "./parentesco.calc.js";
import {
  recomendarAcasalamento,
  type CandidatoAcasalamento,
  type ConfigRecomendacao,
  type StatusCandidatoAcasalamento,
} from "./recomendar-acasalamento.calc.js";

interface CasoDouradoAcasalamento {
  nome: string;
  femea: Genealogia;
  candidatos: CandidatoAcasalamento[];
  config: ConfigRecomendacao;
  rankingEsperado: number[];
  statusEsperado: Record<string, StatusCandidatoAcasalamento>;
}

interface FixtureCasosDourados {
  versao: number;
  casos: CasoDouradoAcasalamento[];
}

const fixture = fixtureJson as unknown as FixtureCasosDourados;

describe("casos dourados sintéticos de acasalamento", () => {
  it("percorre toda a fixture com o motor real e reproduz ranking e status", () => {
    expect(fixture.versao).toBe(1);
    expect(fixture.casos.length).toBeGreaterThanOrEqual(5);

    for (const caso of fixture.casos) {
      const resultado = recomendarAcasalamento(
        caso.femea,
        caso.candidatos,
        caso.config,
      );
      const statusObtido = Object.fromEntries(
        resultado.map(({ reprodutorId, status }) => [String(reprodutorId), status]),
      );

      expect(
        resultado.map(({ reprodutorId }) => reprodutorId),
        `${caso.nome}: ranking`,
      ).toEqual(caso.rankingEsperado);
      expect(statusObtido, `${caso.nome}: status`).toEqual(
        caso.statusEsperado,
      );
    }
  });
});
