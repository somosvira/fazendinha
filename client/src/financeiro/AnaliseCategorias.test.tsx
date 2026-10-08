// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AnaliseCategorias } from "./AnaliseCategorias";
import { uid } from "../lib/uid.fixture";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const despesas = [{ categoriaId: uid(1), categoria: "Silagem", valor: "800" }, { categoriaId: null, categoria: "Sem categoria", valor: "200" }];
it("inclui todas por padrão e permite combinar categorias e sem categoria", () => {
  render(<AnaliseCategorias despesas={despesas} categorias={[{ id: uid(1), nome: "Silagem" }, { id: uid(2), nome: "Sanidade" }]} />);
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
  const { rerender } = render(<AnaliseCategorias despesas={despesas} categorias={[{ id: uid(2), nome: "Sanidade" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Categorias" }));
  fireEvent.click(screen.getByRole("option", { name: "Sanidade" }));
  expect(screen.getByRole("status").textContent).toContain("Nenhuma despesa");
  expect(screen.getByText("R$ 0,00")).toBeTruthy();
  rerender(<AnaliseCategorias despesas={[{ categoriaId: uid(2), categoria: "Sanidade", valor: "50" }]} categorias={[{ id: uid(2), nome: "Sanidade" }]} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("R$ 50,00")).toBeTruthy();
});
it("abate categorias com estorno de períodos anteriores no total e omite fatias negativas ou zeradas", () => {
  render(<AnaliseCategorias despesas={[...despesas, { categoriaId: uid(2), categoria: "Frete", valor: "-100" }, { categoriaId: uid(3), categoria: "Sem despesa", valor: "0" }]} categorias={[]} />);
  expect(screen.getByText("R$ 900,00")).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).queryByText("Frete")).toBeNull();
  expect(screen.getByRole("list", { name: "Estornos por categoria" }).textContent).toContain("−R$ 100,00");
  expect(within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).queryByText("Sem despesa")).toBeNull();
});
it("agrupa as menores categorias em 'Outras' para que cada fatia tenha cor própria na legenda", () => {
  const muitas = [800, 700, 600, 500, 400, 300, 200, 100].map((valor, indice) => ({ categoriaId: uid(indice + 1), categoria: `Categoria ${indice + 1}`, valor: String(valor) }));
  render(<AnaliseCategorias despesas={muitas} categorias={muitas.map(item => ({ id: item.categoriaId, nome: item.categoria }))} />);
  const itens = within(screen.getByRole("list", { name: "Legenda: Despesas por categoria" })).getAllByRole("listitem");
  expect(itens).toHaveLength(6);
  expect(itens[5].textContent).toContain("Outras (3)");
  expect(itens[5].textContent).toContain("R$ 600,00");
  expect(screen.getByText("R$ 3.600,00")).toBeTruthy();
});

it("abre os lançamentos da categoria e permite consultar a operação", async () => {
  const api = await import("./novo-api");
  const obter = vi.spyOn(api, "obterAnaliseCategorias").mockResolvedValue({ base: "pagamentos", total: "800", categorias: [], linhas: [{ categoriaId: uid(1), operacaoId: uid(8), descricao: "Compra de silagem", data: "2026-10-08", categoria: "Silagem", centroCusto: "Rebanho", classificacao: "CUSTEIO", valor: "800" }] });
  render(<AnaliseCategorias despesas={despesas} categorias={[]} inicio="2026-10-01" fim="2026-10-31" />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhar Silagem" }));
  const dialog = screen.getByRole("dialog", { name: "Silagem" });
  expect(await within(dialog).findByText("Compra de silagem")).toBeTruthy();
  expect(obter).toHaveBeenCalledWith({ inicio: "2026-10-01", fim: "2026-10-31", base: "pagamentos", categoriaId: uid(1) });
  expect(within(dialog).getAllByText("R$ 800,00").length).toBeGreaterThan(0);
  expect(within(dialog).getByRole("link", { name: /Abrir lançamento: Compra de silagem/ }).getAttribute("href")).toBe(`/financeiro/operacoes/${uid(8)}`);
  expect(within(dialog).queryByText("Ver operação")).toBeNull();
  fireEvent.click(within(dialog).getByText("Compra de silagem"));
  expect(window.location.pathname).toBe(`/financeiro/operacoes/${uid(8)}`);
  obter.mockRestore();
});

it("Outras abre só as categorias agrupadas, e permite tentar novamente após erro", async () => {
  const api = await import("./novo-api");
  const obter = vi.spyOn(api, "obterAnaliseCategorias").mockRejectedValueOnce(new Error("Falha na consulta")).mockResolvedValue({ base: "pagamentos", total: "900", categorias: [], linhas: [
    { categoriaId: uid(6), operacaoId: null, descricao: "Lançamento agrupado", data: "2026-10-08", categoria: "Categoria 6", centroCusto: "Sede", classificacao: null, valor: "300" },
    { categoriaId: uid(6), operacaoId: null, descricao: "Lançamento fora do grupo", data: "2026-10-08", categoria: "Categoria 1", centroCusto: "Sede", classificacao: null, valor: "800" },
  ] });
  const muitas = [800, 700, 600, 500, 400, 300, 200, 100].map((valor, indice) => ({ categoriaId: uid(indice + 1), categoria: `Categoria ${indice + 1}`, valor: String(valor) }));
  render(<AnaliseCategorias despesas={muitas} categorias={[]} inicio="2026-10-01" fim="2026-10-31" />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhar Outras (3)" }));
  expect(await screen.findByText("Falha na consulta")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  const dialog = screen.getByRole("dialog", { name: "Outras categorias" });
  expect(await within(dialog).findByText("Lançamento agrupado")).toBeTruthy();
  expect(within(dialog).queryByText("Lançamento fora do grupo")).toBeNull();
  expect(within(dialog).getAllByText("R$ 300,00").length).toBeGreaterThan(0);
  obter.mockRestore();
});

it("pagina lançamentos mantendo o total completo", async () => {
  const api = await import("./novo-api");
  const obter = vi.spyOn(api, "obterAnaliseCategorias").mockResolvedValue({ base: "pagamentos", total: "16", categorias: [], linhas: Array.from({ length: 16 }, (_, indice) => ({ categoriaId: uid(1), operacaoId: uid(indice + 1), descricao: `Lançamento ${indice + 1}`, data: "2026-10-08", categoria: "Silagem", centroCusto: "Sede", classificacao: null, valor: "1" })) });
  render(<AnaliseCategorias despesas={despesas} categorias={[]} inicio="2026-10-01" fim="2026-10-31" />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhar Silagem" }));
  const dialog = screen.getByRole("dialog", { name: "Silagem" });
  expect(await within(dialog).findByText("1–15 de 16 lançamentos")).toBeTruthy();
  expect(within(dialog).getByText("R$ 16,00")).toBeTruthy();
  expect(within(dialog).queryByText("Lançamento 16")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Próxima" }));
  expect(within(dialog).getByText("Lançamento 16")).toBeTruthy();
  expect(within(dialog).getByText("R$ 16,00")).toBeTruthy();
  obter.mockRestore();
});
