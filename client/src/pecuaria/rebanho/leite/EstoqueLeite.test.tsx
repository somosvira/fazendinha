// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EstoqueLeite } from "./EstoqueLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn(), registrarLeite: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: async () => [{ id: "novo", nome: "Produto sem produção", unidade: "L", rastrearPartidas: false }] }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
afterEach(() => { cleanup(); localStorage.clear(); history.replaceState(null, "", "/"); vi.resetAllMocks(); });
const resumo = { classificacaoPendenteLitros: "0", custoPendenteLitros: "0", estadoValor: "OCULTO", quantidadeLitros: "15", comercial: { quantidadeLitros: "10" }, descarteLitros: "5", colostroLitros: "0", produtosSemLastro: 0 };
it("abre agregado de todos os produtos sem exigir seleção e não oferece vendas", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ resumo, itens: [{ produtoId: "p", nome: "Leite da fazenda", quantidadeLitros: "15", comercial: { quantidadeLitros: "10" }, estadoValor: "OCULTO", valorTotal: null }], pagina: 1, porPagina: 20, total: 1 });
  render(<EstoqueLeite podeLancar={false} podeFinanceiro={false} />);
  await screen.findByRole("list", { name: "Saldos de leite por produto" });
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  await screen.findByRole("table", { name: "Saldos de leite por produto" });
  expect(consultarLeite).toHaveBeenCalledWith("/estoque/resumo?busca=&pagina=1&porPagina=20", 2);
  expect(screen.getAllByText("15 L").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Restrito").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /venda|retirada/i })).toBeNull();
});
it("permite tentar novamente sem transformar falha ou falta de lastro em saldo zero", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Rede indisponível")).mockResolvedValue({ resumo: { ...resumo, quantidadeLitros: null, produtosSemLastro: 1 }, itens: [], total: 0, pagina: 1, porPagina: 20 });
  render(<EstoqueLeite podeLancar={false} podeFinanceiro={false} />);
  await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledTimes(2));
  await screen.findByText("Há produtos com saldo sem lastro conciliado.");
  expect(screen.getByText("Não informado")).toBeTruthy();
});

it("oferece a primeira confirmação individual mesmo sem estoque leiteiro", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ resumo, itens: [], total: 0, pagina: 1, porPagina: 20 });
  render(<EstoqueLeite podeLancar podeFinanceiro={false} />);
  await screen.findByRole("list", { name: "Saldos de leite por produto" });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar produção individual" }));
  expect(screen.getByRole("dialog", { name: "Confirmar produção individual" })).toBeTruthy();
  expect(screen.getByLabelText("Dia da produção / retirada")).toBeTruthy();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole("combobox", { name: "Produto de leite" }));
  await screen.findByRole("option", { name: "Produto sem produção" });
});
