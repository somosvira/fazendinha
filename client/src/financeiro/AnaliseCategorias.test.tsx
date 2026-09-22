// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AnaliseCategorias } from "./AnaliseCategorias";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const despesas = [{ categoriaId: 1, categoria: "Silagem", valor: "800" }, { categoriaId: null, categoria: "Sem categoria", valor: "200" }];
it("inclui todas por padrão e permite combinar categorias e sem categoria", () => {
  render(<AnaliseCategorias despesas={despesas} categorias={[{ id: 1, nome: "Silagem" }, { id: 2, nome: "Sanidade" }]} />);
  expect(screen.getByText("R$ 1.000,00")).toBeTruthy();
  expect(screen.queryByLabelText("Data inicial")).toBeNull();
  expect(screen.queryByLabelText("Consultar")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Categorias" }));
  fireEvent.click(screen.getByRole("option", { name: "Silagem" }));
  const legend = screen.getByRole("list", { name: "Legenda: Despesas por categoria" });
  expect(within(legend).queryByText("Sem categoria")).toBeNull();
  expect(screen.getAllByText("R$ 800,00").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("option", { name: "Sem categoria" }));
  expect(screen.getByText("R$ 1.000,00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Limpar (2)" }));
  expect(screen.getByText("R$ 1.000,00")).toBeTruthy();
});
it("mostra vazio para seleção sem despesas e atualiza com o novo período", () => {
  const { rerender } = render(<AnaliseCategorias despesas={despesas} categorias={[{ id: 2, nome: "Sanidade" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Categorias" }));
  fireEvent.click(screen.getByRole("option", { name: "Sanidade" }));
  expect(screen.getByRole("status").textContent).toContain("Nenhuma despesa");
  expect(screen.getByText("R$ 0,00")).toBeTruthy();
  rerender(<AnaliseCategorias despesas={[{ categoriaId: 2, categoria: "Sanidade", valor: "50" }]} categorias={[{ id: 2, nome: "Sanidade" }]} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("R$ 50,00")).toBeTruthy();
});
it("abate categorias com estorno de períodos anteriores no total e omite fatias negativas ou zeradas", () => {
  render(<AnaliseCategorias despesas={[...despesas, { categoriaId: 2, categoria: "Frete", valor: "-100" }, { categoriaId: 3, categoria: "Sem despesa", valor: "0" }]} categorias={[]} />);
  expect(screen.getByText("R$ 900,00")).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).queryByText("Frete")).toBeNull();
  expect(screen.getByRole("list", { name: "Estornos por categoria" }).textContent).toContain("−R$ 100,00");
  expect(within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).queryByText("Sem despesa")).toBeNull();
});
it("agrupa as menores categorias em 'Outras' para que cada fatia tenha cor própria na legenda", () => {
  const muitas = [800, 700, 600, 500, 400, 300, 200, 100].map((valor, indice) => ({ categoriaId: indice + 1, categoria: `Categoria ${indice + 1}`, valor: String(valor) }));
  render(<AnaliseCategorias despesas={muitas} categorias={muitas.map(item => ({ id: item.categoriaId, nome: item.categoria }))} />);
  const itens = within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).getAllByRole("listitem");
  expect(itens).toHaveLength(6);
  expect(itens[5].textContent).toContain("Outras (3)");
  expect(itens[5].textContent).toContain("R$ 600,00");
  expect(screen.getByText("R$ 3.600,00")).toBeTruthy();
});
