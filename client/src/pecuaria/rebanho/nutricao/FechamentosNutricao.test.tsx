// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FechamentosNutricao } from "./FechamentosNutricao";
import * as api from "./api";
vi.mock("../api", () => ({ listarLotes: vi.fn().mockResolvedValue([]), buscarLote: vi.fn().mockResolvedValue({ id: "lote", nome: "Matrizes" }) }));
vi.mock("./api", () => ({ listarFechamentos: vi.fn() }));
beforeEach(() => { window.history.replaceState(null, "", "/pecuaria/nutricao?visualFechamentos=tabela&aba=fechamentos"); vi.clearAllMocks(); vi.mocked(api.listarFechamentos).mockResolvedValue({ itens: [], total: 51, pagina: 1, limite: 25 }); });
afterEach(cleanup);
describe("fechamentos gerais", () => {
  it("mantém o destino do link do lote independente da abertura da linha", async () => {
    const fechamento = { id: "fechamento", inicio: "2026-09-01", fim: "2026-09-10", status: "CONFIRMADO", lote: { id: "lote", nome: "Matrizes" }, propriedade: { nome: "Principal" }, vigencia: { dieta: { nome: "Receita", versao: 1 } }, animalDias: 10, verValores: false } as api.Fechamento;
    vi.mocked(api.listarFechamentos).mockResolvedValue({ itens: [fechamento], total: 1, pagina: 1, limite: 25 });
    render(<FechamentosNutricao />);
    const tabela = await screen.findByRole("table", { name: "Fechamentos de nutrição" });
    fireEvent.click(within(tabela).getByRole("link", { name: "Matrizes" }));
    expect(new URLSearchParams(window.location.search).get("loteId")).toBe("lote");
    expect(new URLSearchParams(window.location.search).has("fechamentoId")).toBe(false);
  });
  it("consulta todos os lotes, pagina e aplica situação na consulta", async () => {
    render(<FechamentosNutricao />);
    await screen.findByText(/Página 1 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenCalledWith(undefined, 1, undefined);
    fireEvent.click(screen.getByRole("button", { name: "Mais fechamentos" }));
    await screen.findByText(/Página 2 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenLastCalledWith(undefined, 2, undefined);
    expect(new URLSearchParams(window.location.search).get("paginaFechamentos")).toBe("2");
    await abrirFiltrosConsulta();
    await alterarControle(screen.getByLabelText("Situação do fechamento"), { target: { value: "ESTORNADO" } });
    await aplicarFiltrosConsulta();
    await waitFor(() => expect(api.listarFechamentos).toHaveBeenLastCalledWith(undefined, 1, "ESTORNADO"));
  });
  it("restaura lote, situação e página por deep link", async () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?visualFechamentos=tabela&aba=fechamentos&filtroLoteId=lote&statusFechamento=CONFIRMADO&paginaFechamentos=2");
    render(<FechamentosNutricao />);
    await screen.findByText(/Página 2 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenCalledWith("lote", 2, "CONFIRMADO");
  });
  it("fixa o lote no seu detalhe e oferece recuperação de falha", async () => {
    vi.mocked(api.listarFechamentos).mockRejectedValueOnce(new Error("Falha de rede"));
    render(<FechamentosNutricao loteId="lote" />);
    await screen.findByText("Falha de rede");
    expect(screen.queryByLabelText("Lote")).toBeNull();
    expect(screen.getByRole("link", { name: "Matrizes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Todos os lotes" }).getAttribute("href")).toBe("/pecuaria/nutricao?aba=fechamentos");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/Página 1 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenLastCalledWith("lote", 1, undefined);
  });
});
