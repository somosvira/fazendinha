// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  IndicadoresAcompanhamento,
  type AcompanhamentoIndicadores,
} from "./IndicadoresAcompanhamento";
afterEach(cleanup);
function dados(): AcompanhamentoIndicadores {
  const linha = {
    animalId: "animal-9",
    cicloId: "ciclo-9",
    inicio: "2026-01-01",
    primeiraLiberacao: { data: "2026-02-01" },
    primeiroServico: null,
    diasPartoServico: null,
    diasFimPevServico: null,
    diasLiberacaoServico: null,
    diasEsperaObservada: 8,
    esperaObservadaAte: "2026-02-09",
    repeticoes: 0,
    restricoesIntermediarias: [],
    pendencias: [],
    saidaEm: null,
    antecipacoes: [],
  };
  return {
    versao: 2,
    versaoMetodologia: "ACOMPANHAMENTO_GERENCIAL_V1",
    identificacoes: [{ id: "animal-9", brinco: "09", nome: "Matriz" }],
    pendenciasOrigemCiclo: [
      { animalId: "sem-origem", motivo: "CICLO_DESCONHECIDO" },
    ],
    espera: {
      coorte: [],
      filaAtual: [linha],
      pendenciasFila: [
        {
          motivo: "LIBERACAO_NAO_COMPROVADA",
          linha: { ...linha, cicloId: "ciclo-pendente", animalId: "pendente" },
        },
      ],
      resumoCoorte: {
        ciclos: 0,
        comServico: 0,
        semServico: 0,
        saidas: 0,
        repeticoes: 0,
        mediaDiasLiberacaoServico: null,
      },
    },
    perdas: {
      janelaDias: 42,
      numerador: null,
      denominador: null,
      percentual: null,
      contagens: {
        gestacoes: 0,
        perdasAteCorte: 0,
        perdasRegistradas: 0,
        abortos: 0,
        incompletos: 0,
        semPrimeiroDg: 0,
        encerramentosNaoIdentificados: 0,
      },
      composicaoNumerador: { perdasRegistradas: 0, abortos: 0 },
      coorte: [],
    },
    iep: {
      modo: "VIVOS_NATIMORTOS",
      mediaDias: null,
      pares: [],
      abortos: [],
      pendencias: [
        { partoId: "parto-desconhecido", motivo: "DESFECHO_NAO_COMPROVADO" },
      ],
      semAnterior: [],
    },
    tentativasPorConcepcao: { estado: "CALCULADO", linhas: [], pendencias: [] },
  };
}
it("separa fila liberada das pendências e conserva sítio no link do animal", () => {
  render(
    <IndicadoresAcompanhamento
      dados={dados()}
      secao="fila"
      propriedadeId={9}
    />,
  );
  expect(
    screen.getByRole("link", { name: "09 · Matriz" }).getAttribute("href"),
  ).toBe("/pecuaria/rebanho/animais/animal-9?sitio=9#reproducao");
  expect(
    screen.queryByRole("heading", { name: /Pendências fora da fila/ }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Perdas gestacionais" }),
  ).toBeNull();
  expect(screen.getByText(/Espera observada: 8 até 09\/02\/2026/)).toBeTruthy();
});
it("pendências têm tabela própria, incluindo origem desconhecida e lacunas analíticas", () => {
  render(
    <IndicadoresAcompanhamento
      dados={dados()}
      secao="pendencias"
      propriedadeId={9}
    />,
  );
  expect(screen.getAllByRole("table")).toHaveLength(2);
  expect(screen.getByText("Origem do ciclo não comprovada")).toBeTruthy();
  expect(screen.getByText("parto-desconhecido")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "09 · Matriz" })).toBeNull();
  expect(screen.queryByText(/Espera observada: 8/)).toBeNull();
});
it("desempenho conserva nulo como não comprovado na janela de perdas", () => {
  render(
    <IndicadoresAcompanhamento
      dados={dados()}
      secao="desempenho"
      propriedadeId={9}
    />,
  );
  expect(
    screen.getByText(
      /Numerador Não comprovado \/ denominador com seguimento demonstrável Não comprovado/,
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Tentativas por concepção" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Intervalo entre partos" }),
  ).toBeTruthy();
});
