// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { GraficoProducaoLeite } from "./GraficoProducaoLeite";
const abrir = vi.fn();
const itens = [{ id: "a", nome: "Manhã", litros: 0 }, { id: "b", nome: "Tarde", litros: null }];
beforeEach(() => { localStorage.clear(); history.replaceState(null, "", "/pecuaria/leite?leiteSecao=ordenhas&ordenhasBusca=outubro&paginaOrdenhas=2#origem"); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const consulta = () => <ListaConsultaLeite preferencia="ordenhasVisualizacao" rotulo="Ordenhas" itens={itens} chaveDe={r => r.id} onAbrir={r => abrir(r.id)} colunas={[
  { chave: "nome", titulo: "Ordenha", principal: true, celula: r => r.nome },
  { chave: "litros", titulo: "Litros", celula: r => r.litros === null ? "Não aferido" : `${r.litros} L` },
  { chave: "acoes", titulo: "Ação", acoes: true, celula: r => <Button onClick={() => abrir(`acao:${r.id}`)}>Conferir {r.nome}</Button> },
]} />;
it("alterna cartões e tabela preservando filtros, página e ações independentes", () => {
  render(consulta());
  const cartoes = screen.getByRole("list", { name: "Ordenhas" });
  expect(within(cartoes).getByText("0 L")).toBeTruthy();
  expect(within(cartoes).getByText("Não aferido")).toBeTruthy();
  fireEvent.click(within(cartoes).getByRole("button", { name: "Conferir Manhã" }));
  expect(abrir.mock.calls).toEqual([["acao:a"]]);
  fireEvent.click(within(cartoes).getByRole("button", { name: "Tarde" }));
  expect(abrir).toHaveBeenLastCalledWith("b");
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getByRole("table", { name: "Ordenhas" })).toBeTruthy();
  expect(location.search).toContain("ordenhasBusca=outubro");
  expect(location.search).toContain("paginaOrdenhas=2");
  expect(location.search).toContain("ordenhasVisualizacao=tabela");
  expect(location.hash).toBe("#origem");
  fireEvent.click(screen.getByRole("button", { name: "Cartões" }));
  expect(screen.getByRole("list", { name: "Ordenhas" })).toBeTruthy();
});
it("restaura o modo do histórico sem consultar ou alterar fatos", () => {
  render(consulta());
  history.replaceState(null, "", "/pecuaria/leite?ordenhasVisualizacao=tabela");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.getByRole("table", { name: "Ordenhas" })).toBeTruthy();
  expect(abrir).not.toHaveBeenCalled();
});
it("gráfico conserva zero, ausência e completude na descrição acessível dos grupos reais", () => {
  render(<GraficoProducaoLeite grupos={[
    { periodo: "2026-10-01", litros: 0, completa: true },
    { periodo: "2026-10-02", litros: null, completa: false },
    { periodo: "2026-10-03", litros: 12, completa: false },
  ]} />);
  const valores = within(screen.getByRole("list", { name: "Valores do gráfico" }));
  expect(valores.getByText("2026-10-01: 0 L; cobertura completa.")).toBeTruthy();
  expect(valores.getByText("2026-10-02: Não aferido; cobertura parcial.")).toBeTruthy();
  expect(valores.getByText("2026-10-03: 12 L; cobertura parcial.")).toBeTruthy();
});
