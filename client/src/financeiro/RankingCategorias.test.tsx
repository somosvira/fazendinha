// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RankingCategorias } from "./RankingCategorias";
import { obterAnaliseCategorias } from "./novo-api";
vi.mock("./novo-api", () => ({ obterAnaliseCategorias: vi.fn().mockResolvedValue({ total: "0", categorias: [], linhas: [] }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("mostra uma única categoria sem rosca e abre seus lançamentos", async () => {
  render(<RankingCategorias despesas={[{ categoriaId: "c1", categoria: "Alimentação", valor: "12000" }]} categorias={[]} inicio="2026-10-01" fim="2026-10-31" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText(/100%/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Detalhar Alimentação" }));
  expect(await screen.findByRole("dialog", { name: "Alimentação" })).toBeTruthy();
  expect(obterAnaliseCategorias).toHaveBeenCalledWith({ inicio: "2026-10-01", fim: "2026-10-31", base: "pagamentos", categoriaId: "c1" });
});
it("limita o ranking a cinco, ordena valores e preserva todas no modal", () => {
  render(<RankingCategorias despesas={Array.from({ length: 7 }, (_, i) => ({ categoriaId: `c${i}`, categoria: `Categoria ${i}`, valor: `${i + 1}` }))} categorias={[]} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getAllByRole("listitem")[0].textContent).toContain("Categoria 6");
  expect(screen.queryByText("Categoria 0")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
  const modal = screen.getByRole("dialog", { name: "Despesas por categoria" });
  expect(within(modal).getAllByRole("listitem")).toHaveLength(7);
  expect(within(modal).getByRole("button", { name: "Categorias" })).toBeTruthy();
});
it("preserva total líquido e identifica estornos sem percentuais negativos", () => {
  render(<RankingCategorias despesas={[{ categoriaId: "c1", categoria: "Ração", valor: "100" }, { categoriaId: "c2", categoria: "Frete", valor: "-20" }]} categorias={[]} />);
  expect(screen.getByText(/total líquido R\$\s*80,00/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByText(/Estorno/, { selector: "span" })).toBeTruthy();
  expect(within(modal).getByText("Frete")).toBeTruthy();
});
