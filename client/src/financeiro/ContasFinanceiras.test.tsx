import { alterarControle } from "../lib/controles.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { obterConfiguracoesFinanceiras, obterExtratoConta } from "./novo-api";
import { uid } from "../lib/uid.fixture";

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
      { id: uid(1), nome: "Banco principal", tipo: "BANCO", instituicao: "Banco A", identificacao: "001", saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: uid(2), nome: "Caixa auxiliar", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "50", dataSaldoAbertura: "2026-09-01", saldoAtual: "50", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: uid(3), nome: "Conta inativa", tipo: "APLICACAO", instituicao: null, identificacao: null, saldoAbertura: "20", dataSaldoAbertura: "2026-09-01", saldoAtual: "20", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
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
    fireEvent.click(screen.getByLabelText("Conta de origem"));
    expect(screen.getAllByRole("option", { name: /Banco principal/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: /Caixa auxiliar/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
  it("permite consultar o histórico de uma conta inativa", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole("link", { name: "Ver conta Conta inativa" }))[0]);
    expect(window.location.pathname).toBe(`/financeiro/contas/${uid(3)}`);
    await waitFor(() => expect(obterExtratoConta).toHaveBeenLastCalledWith(uid(3)));
    expect(screen.getAllByRole("heading", { name: "Conta inativa" })).toBeTruthy();
  });

  it("filtra a tabela de contas por busca, tipo, instituição e situação", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    const secao = await screen.findByRole("region", { name: "Contas" });
    const tabela = () => within(secao).queryByRole("table", { name: "Contas financeiras" });
    await alterarControle(within(secao).getByLabelText("Buscar conta"), { target: { value: "001" } });
    expect(within(tabela()!).getByText("Banco principal")).toBeTruthy();
    expect(within(tabela()!).queryByText("Caixa auxiliar")).toBeNull();
    await alterarControle(within(secao).getByLabelText("Buscar conta"), { target: { value: "" } });
    await alterarControle(within(secao).getByLabelText("Tipo"), { target: { value: "CAIXA" } });
    expect(within(tabela()!).getByText("Caixa auxiliar")).toBeTruthy();
    await alterarControle(within(secao).getByLabelText("Tipo"), { target: { value: "" } });
    await alterarControle(within(secao).getByLabelText("Instituição"), { target: { value: "Banco A" } });
    expect(within(tabela()!).getByText("Banco principal")).toBeTruthy();
    await alterarControle(within(secao).getByLabelText("Situação"), { target: { value: "INATIVA" } });
    expect(within(secao).getByText("Nenhuma conta encontrada para os filtros selecionados.")).toBeTruthy();
  });
});

it("abre uma conta diretamente e não substitui uma conta inexistente", async () => {
  window.history.replaceState(null, "", `/financeiro/contas/${uid(2)}`);
  render(<ContasFinanceiras onNav={vi.fn()} />);
  await waitFor(() => expect(obterExtratoConta).toHaveBeenLastCalledWith(uid(2)));
  fireEvent.click(screen.getByRole("button", { name: /Voltar para contas/ }));
  expect(window.location.pathname).toBe("/financeiro/contas");
  expect(screen.getAllByRole("link", { name: "Ver conta Banco principal" })[0]).toBeTruthy();
  cleanup();
  vi.mocked(obterExtratoConta).mockClear();
  window.history.replaceState(null, "", `/financeiro/contas/${uid(999)}`);
  render(<ContasFinanceiras onNav={vi.fn()} />);
  expect(await screen.findByText("Esta conta não está disponível na fazenda selecionada.")).toBeTruthy();
  expect(obterExtratoConta).not.toHaveBeenCalled();
});

it("localiza o movimento do endereço depois de carregar o extrato", async () => {
  const scroll = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  window.history.replaceState(null, "", `/financeiro/contas/${uid(1)}#movimento-${uid(42)}`);
  vi.mocked(obterExtratoConta).mockResolvedValue([{ id: uid(42), seq: 42, direcao: "ENTRADA", valor: "10", transacao: { id: uid(4), seq: 4, tipo: "RECEBIMENTO", status: "CONFIRMADA", data: "2026-09-13", descricao: "Movimento alvo", formaPagamento: null, parceiro: null, operacao: null } }]);
  try {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }));
    expect(document.activeElement?.getAttribute("data-ancora")).toBe(`movimento-${uid(42)}`);
  } finally { rects.mockRestore(); HTMLElement.prototype.scrollIntoView = originalScroll; }
});

it("identifica no extrato que a reversão veio do cancelamento de uma operação e linka de volta", async () => {
  window.history.replaceState(null, "", `/financeiro/contas/${uid(1)}`);
  vi.mocked(obterExtratoConta).mockResolvedValue([
    { id: uid(50), seq: 50, direcao: "ENTRADA", valor: "60", transacao: { id: uid(9), seq: 9, tipo: "REVERSAO", status: "CONFIRMADA", data: "2026-09-20", descricao: "Cancelamento da operação #5: fornecedor errado", formaPagamento: null, parceiro: null, operacao: { id: uid(5), numero: 5, descricao: "Compra de ração", tipo: "COMPRA_ESTOQUE" }, reversaoDe: { tipo: "PAGAMENTO" } } },
  ]);
  render(<ContasFinanceiras onNav={vi.fn()} />);
  expect((await screen.findAllByText(/Estorno pelo cancelamento da OP-0005/)).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "OP-0005" }).length).toBeGreaterThan(0);
});


it("abre a página que contém o movimento indicado no endereço", async () => {
  const scroll = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const itens = Array.from({ length: 20 }, (_, i) => ({ id: uid(100 + i), seq: i + 1, direcao: "ENTRADA" as const, valor: "10", transacao: { id: uid(200 + i), seq: i + 1, tipo: "RECEBIMENTO", status: "CONFIRMADA", data: "2026-09-13", descricao: `Movimento paginado ${i + 1}`, formaPagamento: null, parceiro: null, operacao: null } }));
  vi.mocked(obterExtratoConta).mockResolvedValue(itens);
  window.history.replaceState(null, "", `/financeiro/contas/${uid(1)}#movimento-${itens[17].id}`);
  try {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    await waitFor(() => expect(document.activeElement?.getAttribute("data-ancora")).toBe(`movimento-${itens[17].id}`));
    const tabela = within(screen.getByRole("table", { name: "Extrato de Banco principal" }));
    expect(tabela.getAllByRole("row")).toHaveLength(6);
    expect(tabela.queryByText("Movimento paginado 1")).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação do extrato da conta" })).getByRole("button", { name: "Anterior" }));
    expect(tabela.getByText("Movimento paginado 1")).toBeTruthy();
  } finally { rects.mockRestore(); HTMLElement.prototype.scrollIntoView = originalScroll; }
});


it("pagina contas e busca em todos os registros antes de paginar", async () => {
  const cfg = await obterConfiguracoesFinanceiras();
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ ...cfg, contas: Array.from({ length: 17 }, (_, i) => ({ ...cfg.contas[0], id: uid(i + 1), nome: `Conta ${String(i + 1).padStart(2, "0")}` })) });
  render(<ContasFinanceiras onNav={vi.fn()} />);
  const tabela = within(await screen.findByRole("table", { name: "Contas financeiras" }));
  expect(tabela.getAllByRole("row")).toHaveLength(16);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação das contas" })).getByRole("button", { name: "Próxima" }));
  expect(tabela.getByText("Conta 17")).toBeTruthy();
  expect(tabela.queryByText("Conta 01")).toBeNull();
  await alterarControle(screen.getByLabelText("Buscar conta"), { target: { value: "Conta 01" } });
  expect(tabela.getByText("Conta 01")).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Paginação das contas" }).textContent).toContain("1–1 de 1");
});


it("prioriza contas e extrato com gráfico recolhido e sem ações redundantes", async () => {
  render(<ContasFinanceiras onNav={vi.fn()} />);
  const grafico = await screen.findByRole("button", { name: "Mostrar receitas e despesas" });
  expect(grafico.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("region", { name: "Gráfico de receitas e despesas" })).toBeNull();
  const paginacao = screen.getByRole("navigation", { name: "Paginação das contas" });
  expect(within(paginacao).queryByRole("button", { name: "Próxima" })).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "Ação" })).toBeNull();
  fireEvent.click(grafico);
  expect(grafico.getAttribute("aria-expanded")).toBe("true");
});
