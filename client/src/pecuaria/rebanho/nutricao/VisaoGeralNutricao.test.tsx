// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta, alterarControle } from "@/lib/controles.fixture";
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
  window.history.replaceState(null, "", "/pecuaria/nutricao?visualNutricao=tabela");
  vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [lote("mat", "Matrizes", 5, true), lote("rec", "Recria", 3, false)], verValores: true });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
describe("panorama nutricional sem indicadores repetidos", () => {
  it("reúne cobertura e efetivo no mesmo painel sem quatro cards de métricas", async () => {
    render(<VisaoGeralNutricao />);
    await screen.findByLabelText("Efetivo nos lotes");
    expect(document.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { name: /Nutrição por lote/ })).toBeTruthy();
    expect(screen.getAllByText(/8 animais ativos nos lotes/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Filtros" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Anterior" })).toBeNull();
    expect(screen.getByRole("table", { name: "Nutrição por lote" })).toBeTruthy();
    expect(document.querySelector(".nutricao-metricas")).toBeNull();
    expect(screen.queryByText("Animais nos lotes")).toBeNull();
    expect(screen.getByText(/8 animais ativos nos lotes/)).toBeTruthy();
  });
  it("mantém o contexto inteiro no panorama e preserva a busca ao refinar a dieta", async () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?buscaLote=Matrizes");
    render(<VisaoGeralNutricao />);
    await screen.findByLabelText("Efetivo nos lotes");
    expect(screen.getByRole("button", { name: "Filtros" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Matrizes" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Recria" })).toBeNull();
    expect(screen.getByText(/8 animais ativos nos lotes/)).toBeTruthy();
    await abrirFiltrosConsulta();
    await alterarControle(screen.getByRole("combobox",{name:"Situação da dieta"}),{target:{value:"sem"}});
    await aplicarFiltrosConsulta();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("situacaoDieta")).toBe("sem");
    expect(params.get("buscaLote")).toBe("Matrizes");
    expect(screen.getByRole("button", { name: /Remover filtro: Sem dieta vigente/ })).toBeTruthy();
    expect(screen.getByText("Nenhum lote corresponde aos filtros.")).toBeTruthy();
  });
  it("abre o lote pelo nome sem ação duplicada e alinha quantidades e custos", async () => {
    const { container } = render(<VisaoGeralNutricao />);
    await screen.findByRole("table", { name: "Nutrição por lote" });
    const tabela = container.querySelector("table")!;
    expect(screen.queryByText(/Abrir lote →/)).toBeNull();
    expect(tabela.querySelector('[data-fin-coluna="abrir"]')).toBeNull();
    expect(tabela.querySelector('th[data-fin-coluna="animais"]')?.className).toContain("text-right");
    expect(tabela.querySelector('th[data-fin-coluna="custo"]')?.className).toContain("text-right");
    fireEvent.click(screen.getAllByRole("link", { name: "Matrizes" })[0]);
    expect(vi.mocked(navegarPara).mock.calls.at(-1)?.[0]).toContain("loteId=mat");
  });
  it("não apresenta custo mesmo quando há valores no payload sem permissão", async () => {
    vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [lote("mat", "Matrizes", 5, true)], verValores: false });
    render(<VisaoGeralNutricao />);
    await screen.findByLabelText("Efetivo nos lotes");
    expect(screen.queryByRole("columnheader", { name: "Custo histórico" })).toBeNull();
    expect(screen.queryByText(/379,50/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sobre o custo histórico" })).toBeNull();
  });
  it("sem lotes mantém o estado vazio sem fabricar cobertura", async () => {
    vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [], verValores: false });
    render(<VisaoGeralNutricao />);
    await screen.findByText(/Nenhum lote ativo neste contexto/);
    expect(screen.queryByRole("button", { name: /Com dieta/ })).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
  });
});

it("filtra pelo resumo de dietas sem reduzir a base completa nem perder a busca", async () => {
  window.history.replaceState(null, "", "/pecuaria/nutricao?buscaLote=Matrizes");
  render(<VisaoGeralNutricao />);
  const sem = await screen.findByRole("button", { name: "Sem dieta 1" });
  expect(screen.getByText("1 de 2 lotes")).toBeTruthy();
  fireEvent.click(sem);
  expect(new URLSearchParams(window.location.search).get("situacaoDieta")).toBe("sem");
  expect(new URLSearchParams(window.location.search).get("buscaLote")).toBe("Matrizes");
  expect(screen.getByText("1 de 2 lotes")).toBeTruthy();
  expect(screen.getByText("Nenhum lote corresponde aos filtros.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sem dieta 1" }));
  expect(new URLSearchParams(window.location.search).has("situacaoDieta")).toBe(false);
});

it("alterna cartões e tabela sem perder a busca e oculta custos sem permissão", async () => {
  window.history.replaceState(null, "", "/pecuaria/nutricao?visualNutricao=visual&buscaLote=Matrizes");
  vi.mocked(consultarVisaoNutricional).mockResolvedValue({ lotes: [lote("mat", "Matrizes", 5, true),lote("rec","Recria",3,false)], verValores: false });
  render(<VisaoGeralNutricao />);
  await screen.findByRole("link", {name:"Matrizes"});
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText(/379,50/)).toBeNull();
  expect(screen.getByRole("img",{name:"1 de 2 lotes com dieta vigente"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Tabela"}));
  expect(screen.getByRole("table",{name:"Nutrição por lote"})).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get("buscaLote")).toBe("Matrizes");
  expect(screen.queryByRole("columnheader",{name:"Custo histórico"})).toBeNull();
});

it("mantém um único link nativo por cartão, com nome acessível e destino do lote", async () => {
  window.history.replaceState(null, "", "/pecuaria/nutricao?visualNutricao=visual");
  const { container } = render(<VisaoGeralNutricao />);
  await screen.findByRole("link", { name: "Matrizes" });
  const cartao = container.querySelector(".dietas-cartao")!;
  expect(cartao.querySelectorAll("a")).toHaveLength(1);
  const link = cartao.querySelector("a")!;
  expect(link.className).toContain("dietas-cartao-link");
  expect(link.getAttribute("href")).toContain("loteId=mat");
  fireEvent.click(link);
  expect(vi.mocked(navegarPara).mock.calls.at(-1)?.[0]).toContain("loteId=mat");
});
