// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnaliseCategorias } from "./AnaliseCategorias";
import { obterAnaliseCategorias, obterConfiguracoesFinanceiras } from "./novo-api";
import { escolher, escolherData, prepararPopups } from "./campos.test-utils";
vi.mock("./novo-api", () => ({ obterAnaliseCategorias: vi.fn(), obterConfiguracoesFinanceiras: vi.fn() }));
beforeEach(prepararPopups);
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("consulta o recorte escolhido e mantém categorias inativas disponíveis para histórico", async () => {
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas: [], parceiros: [], produtos: [], categorias: [{ id: 1, nome: "Silagem", ativo: false, ordem: 0, classificacao: "CUSTEIO" }], centrosCusto: [{ id: 2, nome: "Pecuária", ativo: true, ordem: 0 }] });
  vi.mocked(obterAnaliseCategorias).mockResolvedValue({ base: "compras", total: "800.00", categorias: [{ categoria: "Silagem", valor: "800.00" }], linhas: [{ operacaoId: 7, descricao: "Compra mista", data: "2026-09-01", categoria: "Silagem", centroCusto: "Pecuária", classificacao: "CUSTEIO", valor: "800.00" }] });
  render(<AnaliseCategorias />);
  expect(await screen.findByRole("link", { name: "Compra mista" })).toHaveProperty("href", expect.stringContaining("/financeiro/operacoes/7"));
  await escolher("Consultar", "Pagamentos");
  await escolher("Categoria", "Silagem (inativa)");
  await escolher("Centro de custo", "Pecuária");
  await escolherData("Data inicial", "1 de setembro de 2026");
  await escolherData("Data final", "30 de setembro de 2026");
  await waitFor(() => expect(obterAnaliseCategorias).toHaveBeenLastCalledWith({ base: "pagamentos", categoriaId: "1", centroCustoId: "2", inicio: "2026-09-01", fim: "2026-09-30" }));
});

it("abre pagamentos avulsos no movimento da conta", async () => {
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas: [], parceiros: [], produtos: [], categorias: [], centrosCusto: [] });
  vi.mocked(obterAnaliseCategorias).mockResolvedValue({ base: "pagamentos", total: "100", categorias: [{ categoria: "Sem categoria", valor: "100" }], linhas: [{ operacaoId: null, contaId: 3, movimentoId: 9, descricao: "Frete avulso", data: "2026-09-01", categoria: "Sem categoria", centroCusto: "Sem centro de custo", classificacao: null, valor: "100" }] });
  render(<AnaliseCategorias />);
  expect(await screen.findByRole("link", { name: "Frete avulso" })).toHaveProperty("href", expect.stringContaining("/financeiro/contas/3#movimento-9"));
});

it("explica em linguagem simples o que cada consulta soma", async () => {
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas: [], parceiros: [], produtos: [], categorias: [], centrosCusto: [] });
  vi.mocked(obterAnaliseCategorias).mockResolvedValue({ base: "compras", total: "0", categorias: [], linhas: [] });
  render(<AnaliseCategorias />);
  fireEvent.click(await screen.findByRole("combobox", { name: "Consultar" }));
  expect((await screen.findByRole("option", { name: "Compras e serviços" })).textContent).toContain("pela data da compra");
  expect(screen.getByRole("option", { name: "Pagamentos" }).textContent).toContain("pela data do pagamento");
  expect(screen.getByRole("option", { name: "A pagar" }).textContent).toContain("vencem no período");
});
