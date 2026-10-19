import { beforeEach, expect, it, vi } from "vitest";
import {
  consultarElegibilidade,
  listarPoliticas,
  vincularPolitica,
} from "./elegibilidade-api";
import {
  consultarIndicadores,
  exportarIndicadoresCsv,
  type SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";
import { reqV4 } from "./api";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue({}) }));
beforeEach(() => vi.clearAllMocks());
it("envia o sítio explícito no cabeçalho e nos filtros sem estimativa implícita", async () => {
  await consultarElegibilidade("a", 8, "2026-10-14");
  expect(reqV4).toHaveBeenLastCalledWith(
    "/reproducao/animais/a/elegibilidade?propriedadeId=8&data=2026-10-14",
    undefined,
    "GET",
    8,
  );
  await listarPoliticas(8);
  expect(reqV4).toHaveBeenLastCalledWith(
    "/reproducao/politicas-elegibilidade?propriedadeId=8",
    undefined,
    "GET",
    8,
  );
  await consultarIndicadores({
    propriedadeId: 8,
    inicio: "2026-09-01",
    fim: "2026-09-21",
    corte: "2026-10-14",
    deslocamentoTeDias: 0,
  });
  const chamada = vi.mocked(reqV4).mock.calls.at(-1)!;
  expect(chamada[0]).toContain("deslocamentoTeDias=0");
  expect(chamada[0]).not.toContain("concepcaoEstimada");
  expect(chamada[3]).toBe(8);
});
it("associação do ciclo só grava quando chamada explicitamente", async () => {
  await vincularPolitica({
    chave: "k",
    animalId: "a",
    propriedadeId: 8,
    partoId: "p",
  });
  expect(reqV4).toHaveBeenCalledTimes(1);
  expect(reqV4).toHaveBeenLastCalledWith(
    "/reproducao/vinculos-politica-ciclo",
    { chave: "k", animalId: "a", propriedadeId: 8, partoId: "p" },
    "POST",
    8,
  );
});
it("CSV conserva total da API sem recomputar média e usa vazio para null", () => {
  const c = {
    elegiveis: null,
    matrizesServidas: 2,
    tentativas: 4,
    positivas: 2,
    negativas: 1,
    abertas: 1,
  };
  const s = {
    versaoMetodologia: "v1",
    metodologia: {
      rotulo: 'Base "citada"',
      concepcaoEstimada: null,
      deslocamentoTeDias: 7,
    },
    filtros: { corte: "2026-10-14" },
    periodos: [],
    totais: {
      contagens: c,
      taxas: { servico: null, concepcao: 200 / 3, prenhez: null },
    },
    pendencias: ["ELEGIBILIDADE_PENDENTE"],
  } as unknown as SnapshotIndicadoresReprodutivos;
  const csv = exportarIndicadoresCsv(s);
  expect(csv).toContain('"Base ""citada"""');
  expect(csv).toContain(
    '"TOTAL";"";"";"2";"4";"2";"1";"1";"";"66.66666666666667";""',
  );
});
