// @vitest-environment jsdom
import "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisaoGeralNutricao } from "./VisaoGeralNutricao";
import { consultarVisaoNutricional, type ResumoNutricional } from "./api";
import { navegarPara } from "../../../router";

vi.mock("./api", () => ({ consultarVisaoNutricional: vi.fn() }));
vi.mock("../../../router", () => ({ navegarPara: vi.fn() }));
function lote(id: string, nome: string, animais: number, comDieta: boolean): ResumoNutricional {
  return { lote: { id, nome, propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, ativo: true, animaisAtivos: animais, observacao: null }, vigente: comDieta ? { id: "v", desde: "2026-09-01", ate: null, dieta: { id: "d", nome: "Dieta atual", versao: 1 } } : null, programada: null, verValores: true, custos: { custoConhecido: "379.50", custoPorAnimalDia: "6.90", animalDias: 55, fechamentos: 1, coberturaCustoCompleta: true } };
}
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/nutricao");
  vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [lote("mat", "Matrizes", 5, true), lote("rec", "Recria", 3, false)], verValores: true });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
describe("panorama nutricional sem indicadores repetidos", () => {
  it("reúne cobertura e efetivo no mesmo painel sem quatro cards de métricas", async () => {
    render(<VisaoGeralNutricao />);
    const titulo = await screen.findByRole("heading", { name: "Panorama nutricional" });
    const painel = titulo.closest('[data-slot="financeiro-panel"]');
    const comparativos = titulo.closest("details")!;
    expect(comparativos.open).toBe(false);
    fireEvent.click(comparativos.querySelector("summary")!);
    expect(comparativos.open).toBe(true);
    expect(screen.getByRole("table", { name: "Nutrição por lote" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cobertura das dietas", level: 3 }).closest('[data-slot="financeiro-panel"]')).toBe(painel);
    expect(screen.getByRole("heading", { name: "Efetivo por lote", level: 3 }).closest('[data-slot="financeiro-panel"]')).toBe(painel);
    expect(document.querySelector(".nutricao-metricas")).toBeNull();
    expect(screen.queryByText("Animais nos lotes")).toBeNull();
    expect(screen.getByText(/8 animais ativos nos lotes/)).toBeTruthy();
  });
  it("mantém o contexto inteiro no panorama e preserva a busca ao refinar a dieta", async () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?buscaLote=Matrizes");
    render(<VisaoGeralNutricao />);
    await screen.findByRole("heading", { name: "Panorama nutricional" });
    expect(screen.getByText(/Mostrando 1 de 2 lotes/)).toBeTruthy();
    expect(screen.getByText(/8 animais ativos nos lotes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sem dieta vigente/ }));
    const params = new URL(vi.mocked(navegarPara).mock.calls[0][0], "http://localhost").searchParams;
    expect(params.get("situacaoDieta")).toBe("sem");
    expect(params.get("buscaLote")).toBe("Matrizes");
  });
  it("não apresenta custo mesmo quando há valores no payload sem permissão", async () => {
    vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [lote("mat", "Matrizes", 5, true)], verValores: false });
    render(<VisaoGeralNutricao />);
    await screen.findByRole("heading", { name: "Panorama nutricional" });
    expect(screen.queryByRole("columnheader", { name: "Custo total" })).toBeNull();
    expect(screen.queryByText(/379,50/)).toBeNull();
  });
  it("sem lotes mantém o estado vazio sem fabricar cobertura", async () => {
    vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [], verValores: false });
    render(<VisaoGeralNutricao />);
    await screen.findByText(/Nenhum lote ativo neste contexto/);
    expect(screen.queryByRole("button", { name: /Com dieta vigente/ })).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
  });
});
