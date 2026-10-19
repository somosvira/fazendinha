// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
import { consultarIndicadores, listarEmissoesIndicadores, emitirIndicadores, type FiltrosIndicadores, type SnapshotIndicadoresReprodutivos } from "./indicadores-api";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
vi.mock("./indicadores-api", async original => ({ ...await original<typeof import("./indicadores-api")>(), consultarIndicadores: vi.fn(), listarEmissoesIndicadores: vi.fn(), emitirIndicadores: vi.fn() }));
vi.mock("../../../lib/hoje", async original => ({ ...await original<typeof import("../../../lib/hoje")>(), getHoje: () => new Date(2026, 9, 17), getHojeISO: () => "2026-10-17" }));
function snapshot(filtros: FiltrosIndicadores): SnapshotIndicadoresReprodutivos {
  return { versao: 1, versaoMetodologia: "v1", filtros, metodologia: { rotulo: "Metodologia", fontes: [], regras: [], deslocamentoTeDias: 7, concepcaoEstimada: null }, sobraInicial: null, periodos: [],
    totais: { contagens: { vaziasAptasInicio: 0, negativasAnteriores: 0, anterioresSemDiagnostico: 0, estimativaVaziasAnteriores: null, saidasPev: 0, contribuicaoPev: 0, elegiveisConhecidas: 0, elegiveis: null, matrizesServidas: 0, tentativas: 0, positivas: 0, negativas: 0, abertas: 0, naoClassificaveis: 0, denominadorConcepcao: 0, animaisComPendenciaElegibilidade: 0 }, taxas: { servico: null, concepcao: null, prenhez: null }, animaisUnicos: 0, participacoesAnimalPeriodo: 0 }, pendencias: [] };
}
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=indicadores"); vi.mocked(consultarIndicadores).mockImplementation(async f => snapshot(f)); });
afterEach(cleanup);
it("carrega ao abrir com doze meses até hoje e deixa estimativas opcionais em branco", async () => {
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar modo="painel"/>);
  await screen.findByText("Total recalculado");
  expect(consultarIndicadores).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 7, inicio: "2025-11-01", fim: "2026-10-17", corte: "2026-10-17" }));
  expect(vi.mocked(consultarIndicadores).mock.calls[0][0]).not.toHaveProperty("concepcaoEstimada");
  expect(screen.queryByLabelText("Emissões preservadas")).toBeNull();
  expect(listarEmissoesIndicadores).not.toHaveBeenCalled(); expect(emitirIndicadores).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Exportar|Preservar|Imprimir/ })).toBeNull();
  expect(screen.getByText("Filtros avançados").parentElement?.hasAttribute("open")).toBe(false);
});
it("recarrega após mudar período e não deixa resposta antiga sobrescrever o resultado", async () => {
  let resolver!: (s: SnapshotIndicadoresReprodutivos) => void;
  vi.mocked(consultarIndicadores).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar={false} modo="painel"/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  window.history.pushState(null, "", "/pecuaria/reproducao?rotina=indicadores&inicio=2026-01-01&fim=2026-01-21");
  fireEvent(window, new PopStateEvent("popstate"));
  await screen.findByText("Total recalculado");
  resolver(snapshot({ propriedadeId: 7, inicio: "2020-01-01", fim: "2020-01-21", corte: "2020-01-21", deslocamentoTeDias: 7 }));
  await waitFor(() => expect(screen.queryByText(/01\/01\/2020/)).toBeNull());
  expect(consultarIndicadores).toHaveBeenLastCalledWith(expect.objectContaining({ inicio: "2026-01-01", fim: "2026-01-21" }));
});
it("trocar período reutiliza só os critérios confirmados, sem aplicar a estimativa em edição", async () => {
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar={false} modo="painel"/>);
  await screen.findByText("Total recalculado");
  fireEvent.click(screen.getByText("Filtros avançados"));
  fireEvent.change(screen.getByLabelText("Concepção estimada (%) — opcional"), { target: { value: "35" } });
  window.history.pushState(null, "", "/pecuaria/reproducao?rotina=indicadores&inicio=2026-01-01&fim=2026-01-21");
  fireEvent(window, new PopStateEvent("popstate"));
  await waitFor(() => expect(consultarIndicadores).toHaveBeenCalledTimes(2));
  expect(vi.mocked(consultarIndicadores).mock.calls[1][0]).not.toHaveProperty("concepcaoEstimada");
  await screen.findByText("Total recalculado");
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  await waitFor(() => expect(consultarIndicadores).toHaveBeenCalledTimes(3));
  expect(vi.mocked(consultarIndicadores).mock.calls[2][0]).toMatchObject({ concepcaoEstimada: 35 });
  window.history.pushState(null, "", "/pecuaria/reproducao?rotina=indicadores&inicio=2026-02-01&fim=2026-02-21");
  fireEvent(window, new PopStateEvent("popstate"));
  await waitFor(() => expect(consultarIndicadores).toHaveBeenCalledTimes(4));
  expect(vi.mocked(consultarIndicadores).mock.calls[3][0]).toMatchObject({ concepcaoEstimada: 35, inicio: "2026-02-01" });
});
