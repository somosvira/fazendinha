// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { obterConfiguracoesFinanceiras, obterExtratoConta } from "./novo-api";

vi.mock("./novo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  obterConfiguracoesFinanceiras: vi.fn(),
  obterExtratoConta: vi.fn(),
  obterExtratoGeral: vi.fn().mockResolvedValue([]),
  transferir: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro/contas");
  vi.clearAllMocks();
  vi.mocked(obterExtratoConta).mockResolvedValue([]);
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
    contas: [
      { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: "Banco A", identificacao: "001", saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: 2, nome: "Caixa auxiliar", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "50", dataSaldoAbertura: "2026-09-01", saldoAtual: "50", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: 3, nome: "Conta inativa", tipo: "APLICACAO", instituicao: null, identificacao: null, saldoAbertura: "20", dataSaldoAbertura: "2026-09-01", saldoAtual: "20", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
    ],
    parceiros: [], categorias: [], centrosCusto: [], produtos: [],
  });
});

afterEach(cleanup);

describe("ContasFinanceiras — cadastros ativos", () => {
  it("não oferece conta inativa na transferência", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);

    expect((await screen.findAllByText("Banco principal")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Ver conta Conta inativa" })[0]).toBeTruthy();
    expect(obterExtratoConta).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    expect(await screen.findByRole("heading", { name: "Nova transferência" })).toBeTruthy();
    expect(screen.getAllByRole("option", { name: /Banco principal/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: /Caixa auxiliar/ }).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("dialog")).queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
  it("permite consultar o histórico de uma conta inativa", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole("link", { name: "Ver conta Conta inativa" }))[0]);
    expect(window.location.pathname).toBe("/financeiro/contas/3");
    await waitFor(() => expect(obterExtratoConta).toHaveBeenLastCalledWith(3));
    expect(screen.getAllByRole("heading", { name: "Conta inativa" })).toBeTruthy();
  });

  it("filtra a tabela de contas por busca, tipo, instituição e situação", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    const secao = (await screen.findByRole("heading", { name: "Contas" })).closest("section")!;
    const tabela = () => within(secao).queryByRole("table", { name: "Contas financeiras" });
    fireEvent.change(within(secao).getByLabelText("Buscar conta"), { target: { value: "001" } });
    expect(within(tabela()!).getByText("Banco principal")).toBeTruthy();
    expect(within(tabela()!).queryByText("Caixa auxiliar")).toBeNull();
    fireEvent.change(within(secao).getByLabelText("Buscar conta"), { target: { value: "" } });
    fireEvent.change(within(secao).getByLabelText("Tipo"), { target: { value: "CAIXA" } });
    expect(within(tabela()!).getByText("Caixa auxiliar")).toBeTruthy();
    fireEvent.change(within(secao).getByLabelText("Tipo"), { target: { value: "" } });
    fireEvent.change(within(secao).getByLabelText("Instituição"), { target: { value: "Banco A" } });
    expect(within(tabela()!).getByText("Banco principal")).toBeTruthy();
    fireEvent.change(within(secao).getByLabelText("Situação"), { target: { value: "INATIVA" } });
    expect(within(secao).getByText("Nenhuma conta encontrada para os filtros selecionados.")).toBeTruthy();
  });
});

it("abre uma conta diretamente e não substitui uma conta inexistente", async () => {
  window.history.replaceState(null, "", "/financeiro/contas/2");
  render(<ContasFinanceiras onNav={vi.fn()} />);
  await waitFor(() => expect(obterExtratoConta).toHaveBeenLastCalledWith(2));
  fireEvent.click(screen.getByRole("button", { name: /Voltar para contas/ }));
  expect(window.location.pathname).toBe("/financeiro/contas");
  expect(screen.getAllByRole("link", { name: "Ver conta Banco principal" })[0]).toBeTruthy();
  cleanup();
  vi.mocked(obterExtratoConta).mockClear();
  window.history.replaceState(null, "", "/financeiro/contas/999");
  render(<ContasFinanceiras onNav={vi.fn()} />);
  expect(await screen.findByText("Esta conta não está disponível na fazenda selecionada.")).toBeTruthy();
  expect(obterExtratoConta).not.toHaveBeenCalled();
});

it("localiza o movimento do endereço depois de carregar o extrato", async () => {
  const scroll = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  window.history.replaceState(null, "", "/financeiro/contas/1#movimento-42");
  vi.mocked(obterExtratoConta).mockResolvedValue([{ id: 42, direcao: "ENTRADA", valor: "10", transacao: { id: 4, tipo: "RECEBIMENTO", status: "CONFIRMADA", data: "2026-09-13", descricao: "Movimento alvo", formaPagamento: null, parceiro: null, operacao: null } }]);
  try {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }));
    expect(document.activeElement?.getAttribute("data-ancora")).toBe("movimento-42");
  } finally { rects.mockRestore(); HTMLElement.prototype.scrollIntoView = originalScroll; }
});
