// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  IndicadoresReprodutivos,
  numeroIndicador,
  taxaIndicador,
} from "./IndicadoresReprodutivos";
import {
  consultarIndicadores,
  listarEmissoesIndicadores,
  abrirEmissaoIndicadores,
  type SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
vi.mock("./indicadores-api", async (original) => ({
  ...(await original<typeof import("./indicadores-api")>()),
  consultarIndicadores: vi.fn(),
  listarEmissoesIndicadores: vi.fn(),
  abrirEmissaoIndicadores: vi.fn(),
  emitirIndicadores: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function snapshot(propriedadeId = 1): SnapshotIndicadoresReprodutivos {
  const contagens = {
    vaziasAptasInicio: 0,
    negativasAnteriores: 0,
    anterioresSemDiagnostico: 1,
    estimativaVaziasAnteriores: null,
    saidasPev: 0,
    contribuicaoPev: 0,
    elegiveisConhecidas: 0,
    elegiveis: null,
    matrizesServidas: 0,
    tentativas: 1,
    positivas: 0,
    negativas: 0,
    abertas: 1,
    naoClassificaveis: 0,
    denominadorConcepcao: 0,
    animaisComPendenciaElegibilidade: 0,
  };
  const taxas = { servico: null, concepcao: null, prenhez: null };
  return {
    versao: 1,
    versaoMetodologia: "v1",
    metodologia: {
      rotulo: "Base IDEAGRI/IILB — metodologia Fazendinha v1",
      fontes: [],
      regras: ["Totais recalculados"],
      deslocamentoTeDias: 7,
      concepcaoEstimada: null,
    },
    filtros: {
      propriedadeId,
      inicio: "2026-09-01",
      fim: "2026-09-21",
      corte: "2026-09-22",
      deslocamentoTeDias: 7,
    },
    sobraInicial: null,
    periodos: [
      {
        id: "p",
        inicio: "2026-09-01",
        fim: "2026-09-21",
        contagens,
        taxas,
        pendencias: ["CONCEPCAO_ESTIMADA_NAO_INFORMADA"],
        maturidade: {
          corte: "2026-09-22",
          diasAposFim: 1,
          tentativasAbertas: 1,
        },
        detalhamento: [],
      },
    ],
    totais: {
      contagens,
      taxas,
      animaisUnicos: 1,
      participacoesAnimalPeriodo: 1,
    },
    pendencias: ["CONCEPCAO_ESTIMADA_NAO_INFORMADA"],
  };
}
it("conserva zero, null e precisão de apresentação distintos", () => {
  expect(numeroIndicador(0)).toBe("0");
  expect(taxaIndicador(0)).toBe("0%");
  expect(taxaIndicador(null)).toBe("Não calculável");
  expect(numeroIndicador(2 / 3)).toBe("0,67");
});
it("consulta sem inventar concepção estimada e mostra pendências em vez de zero", async () => {
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([]);
  vi.mocked(consultarIndicadores).mockResolvedValue(snapshot());
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false} />);
  fireEvent.change(screen.getByLabelText("Início"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("Fim"), {
    target: { value: "2026-09-21" },
  });
  fireEvent.change(screen.getByLabelText("Corte dos resultados"), {
    target: { value: "2026-09-22" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  await screen.findByText("Total recalculado");
  expect(consultarIndicadores).toHaveBeenCalledWith({
    propriedadeId: 1,
    inicio: "2026-09-01",
    fim: "2026-09-21",
    corte: "2026-09-22",
    deslocamentoTeDias: 7,
    iepModo:"VIVOS_NATIMORTOS",
  });
  expect(screen.getAllByText("Não calculável").length).toBeGreaterThan(1);
  expect(screen.getByRole("status").textContent).toContain(
    "concepção estimada",
  );
  expect(
    screen.queryByRole("button", { name: "Preservar emissão" }),
  ).toBeNull();
});
it("abre a emissão preservada sem reprocessar os fatos atuais e limpa ao trocar sítio", async () => {
  const e = {
    id: "antiga",
    criadoEm: "2026-09-23T12:00:00Z",
    snapshot: snapshot(),
  };
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([e]);
  vi.mocked(abrirEmissaoIndicadores).mockResolvedValue(e);
  const { rerender } = render(
    <IndicadoresReprodutivos propriedadeId={1} podeLancar={true} />,
  );
  await waitFor(() =>
    expect(screen.getByRole("option", { name: /23\/09\/2026/ })).toBeTruthy(),
  );
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), {
    target: { value: "antiga" },
  });
  await screen.findByText(/Emissão preservada em/);
  expect(abrirEmissaoIndicadores).toHaveBeenCalledWith("antiga", 1);
  expect(consultarIndicadores).not.toHaveBeenCalled();
  rerender(<IndicadoresReprodutivos propriedadeId={2} podeLancar={true} />);
  expect(screen.queryByText("Total recalculado")).toBeNull();
});
