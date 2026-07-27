import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import fixtureJson from "./fixtures/acasalamento-casos-dourados.json";
import { carregarCasosDouradosAcasalamento } from "./acasalamento-casos-dourados.fixture.js";
import type { CasoDouradoAcasalamento } from "./import-acasalamento.js";
import { recomendarAcasalamento } from "./recomendar-acasalamento.calc.js";

interface FixtureCasosDourados {
  versao: number;
  casos: CasoDouradoAcasalamento[];
}

const fixture = fixtureJson as unknown as FixtureCasosDourados;
const temporarios: string[] = [];

afterEach(() => {
  for (const diretorio of temporarios.splice(0)) {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

function criarJsonReal(conteudo: unknown): string {
  const diretorio = mkdtempSync(join(tmpdir(), "acasalamento-dourado-"));
  temporarios.push(diretorio);
  const caminho = join(diretorio, "rebanho_real.json");
  writeFileSync(caminho, JSON.stringify(conteudo), "utf8");
  return caminho;
}

function executarCaso(caso: CasoDouradoAcasalamento): void {
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
  expect(statusObtido, `${caso.nome}: status`).toEqual(caso.statusEsperado);
}

describe("gate de casos dourados de acasalamento", () => {
  it("mantém a fixture sintética como default quando a env está ausente", () => {
    const casos = carregarCasosDouradosAcasalamento(fixture.casos, {});
    expect(fixture.versao).toBe(1);
    expect(casos).toEqual(fixture.casos);
  });

  it("lê casos reais de arquivo temporário via env e usa o mesmo runner", () => {
    const casoReal = { ...fixture.casos[0], ideagriId: 9001, nome: "IDEAGRI temporário" };
    const caminho = criarJsonReal({ casosDouradosAcasalamento: [casoReal] });
    const casos = carregarCasosDouradosAcasalamento(fixture.casos, {
      ACASALAMENTO_CASOS_DOURADOS_PATH: caminho,
    });

    expect(casos).toEqual([casoReal]);
    for (const caso of casos) executarCaso(caso);
  });

  it.each([
    ["env vazia", "", /ACASALAMENTO_CASOS_DOURADOS_PATH.*vazio/i],
    ["caminho ausente", join(tmpdir(), "nao-existe-rebanho-real.json"), /não foi possível ler/i],
  ])("falha fechado para %s", (_cenario, caminho, erro) => {
    expect(() => carregarCasosDouradosAcasalamento(fixture.casos, {
      ACASALAMENTO_CASOS_DOURADOS_PATH: caminho,
    })).toThrow(erro);
  });

  it.each([
    ["JSON inválido", "{", /JSON inválido/i],
    ["array ausente", JSON.stringify({}), /casosDouradosAcasalamento.*ausente/i],
    ["array vazio", JSON.stringify({ casosDouradosAcasalamento: [] }), /casosDouradosAcasalamento.*vazio/i],
    ["caso inválido", JSON.stringify({ casosDouradosAcasalamento: [{}] }), /caso dourado inválido/i],
  ])("falha fechado para %s no arquivo real", (_cenario, conteudo, erro) => {
    const diretorio = mkdtempSync(join(tmpdir(), "acasalamento-dourado-"));
    temporarios.push(diretorio);
    const caminho = join(diretorio, "rebanho_real.json");
    writeFileSync(caminho, conteudo, "utf8");

    expect(() => carregarCasosDouradosAcasalamento(fixture.casos, {
      ACASALAMENTO_CASOS_DOURADOS_PATH: caminho,
    })).toThrow(erro);
  });

  it("percorre a fonte selecionada pela env do processo com ranking e status", () => {
    const casos = carregarCasosDouradosAcasalamento(fixture.casos);
    if (!("ACASALAMENTO_CASOS_DOURADOS_PATH" in process.env)) {
      expect(casos.length).toBeGreaterThanOrEqual(5);
    }
    for (const caso of casos) executarCaso(caso);
  });
});
