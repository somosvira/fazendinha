// @vitest-environment jsdom
import { baseFinanceiraVazia } from "./dashboard.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { liquidarCompromisso, listarCompromissos, obterConfiguracoesFinanceiras, obterDashboardFinanceiro, obterExtratoConta, obterExtratoGeral, type Compromisso, type Conta, type MovimentoGeral } from "./novo-api";

vi.mock("./novo-api", async importOriginal => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  obterConfiguracoesFinanceiras: vi.fn(), obterExtratoConta: vi.fn(), obterExtratoGeral: vi.fn(),
  obterDashboardFinanceiro: vi.fn(), listarCompromissos: vi.fn(), liquidarCompromisso: vi.fn(),
}));

const contas: Conta[] = [
  { id: 1, nome: "Banco", tipo: "BANCO", instituicao: "Sicoob", identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "120", incluirNoSaldoGeral: true, ativo: true, temMovimentos: true },
  { id: 2, nome: "Caixa", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: false, ativo: false, temMovimentos: true },
];
function movimento(id: number, contaId: number, valor: string, direcao: "ENTRADA" | "SAIDA", tipo: string, extra: Partial<MovimentoGeral["transacao"]> = {}): MovimentoGeral {
  return { id, contaId, conta: contas[contaId - 1], valor, direcao, transacao: { id, tipo, status: "CONFIRMADA", data: "2026-09-14", descricao: `Movimento ${id}`, operacao: null, parceiro: null, formaPagamento: null, ...extra } };
}
const operacaoTransferencia = { id: 123, tipo: "TRANSFERENCIA_FINANCEIRA", descricao: "Transferência" };
const movimentos = [
  movimento(1, 1, "120", "ENTRADA", "RECEBIMENTO"),
  movimento(2, 2, "25", "SAIDA", "PAGAMENTO"),
  movimento(3, 1, "50", "SAIDA", "TRANSFERENCIA", { operacao: operacaoTransferencia, status: "REVERTIDA" }),
  movimento(4, 2, "50", "ENTRADA", "TRANSFERENCIA", { operacao: operacaoTransferencia, status: "REVERTIDA" }),
  movimento(5, 1, "50", "ENTRADA", "REVERSAO", { operacao: operacaoTransferencia, reversaoDe: { tipo: "TRANSFERENCIA" } }),
  movimento(6, 2, "50", "SAIDA", "REVERSAO", { operacao: operacaoTransferencia, reversaoDe: { tipo: "TRANSFERENCIA" } }),
  movimento(7, 1, "40", "SAIDA", "PAGAMENTO", { status: "REVERTIDA" }),
  movimento(8, 1, "40", "ENTRADA", "REVERSAO", { reversaoDe: { tipo: "PAGAMENTO" } }),
];
const compromisso = (id: number, extra: Partial<Compromisso> = {}): Compromisso => ({
  id, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", dataVencimento: "2026-09-14", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null,
  operacao: { id, tipo: "SERVICO", descricao: `Compromisso ${id}` }, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  window.history.replaceState(null, "", "/financeiro/contas");
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas, parceiros: [], categorias: [], centrosCusto: [], produtos: [] });
  vi.mocked(obterExtratoGeral).mockResolvedValue(movimentos);
  vi.mocked(obterExtratoConta).mockImplementation(async id => movimentos.filter(m => m.contaId === id));
  vi.mocked(liquidarCompromisso).mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const total = (titulo: string) => screen.getByText(titulo).parentElement!.textContent!.replace(/\s/g, " ");

describe("visualizações financeiras integradas", () => {
  it("mantém o gráfico alinhado aos filtros do extrato geral, não aos da listagem", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    await waitFor(() => expect(total("Receitas no período")).toContain("R$ 160,00"));
    expect(total("Despesas no período")).toContain("R$ 65,00");
    expect(screen.getAllByRole("button", { name: "Período" })[0].textContent).toContain("Ano atual");
    expect(screen.queryByLabelText("Data inicial")).toBeNull();
    expect(screen.getByRole("button", { name: "Linhas" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Barras" }));
    expect(screen.getByRole("button", { name: "Barras" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(screen.getByRole("button", { name: "Período" }).textContent).toContain("Últimos 3 meses");
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(obterExtratoGeral).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "CAIXA" } });
    expect(total("Receitas no período")).toContain("R$ 160,00");
    expect(total("Despesas no período")).toContain("R$ 65,00");
    const secaoExtrato = screen.getByRole("heading", { name: "Extrato geral" }).closest("section")!;
    fireEvent.change(within(secaoExtrato).getByLabelText("Instituição"), { target: { value: "__sem__" } });
    expect(total("Receitas no período")).toContain("R$ 0,00");
    expect(total("Despesas no período")).toContain("R$ 25,00");
    fireEvent.click(within(secaoExtrato).getByRole("button", { name: "Período do extrato geral" }));
    fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-15" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(screen.getByText("Sem movimentações no período selecionado para este escopo.")).toBeTruthy();
    expect(within(secaoExtrato).getByText("Nenhuma movimentação encontrada para os filtros selecionados.")).toBeTruthy();
  });

  it.each([1, 2])("o detalhe da conta %s usa somente seu extrato e liga a transferência à operação", async id => {
    window.history.replaceState(null, "", `/financeiro/contas/${id}`);
    const onNav = vi.fn();
    render(<ContasFinanceiras onNav={onNav} />);
    await waitFor(() => expect(total("Receitas no período")).toContain(id === 1 ? "R$ 210,00" : "R$ 50,00"));
    expect(total("Despesas no período")).toContain(id === 1 ? "R$ 90,00" : "R$ 75,00");
    expect(screen.queryByRole("button", { name: "Gerenciar contas" })).toBeNull();
    expect(obterExtratoGeral).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("link", { name: "OP-0123" })[0]);
    expect(window.location.pathname).toBe("/financeiro/operacoes/123");
  });

  it("mostra todos os pendentes no calendário da visão geral, além dos cinco itens da lista", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([
      ...Array.from({ length: 6 }, (_, indice) => compromisso(indice + 1)),
      compromisso(7, { status: "LIQUIDADO" }), compromisso(8, { status: "CANCELADO" }),
    ]);
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [{ data: "2026-09-14", entradas: "120", saidas: "25" }], compromissos: { aPagar: "600", aReceber: "0" }, despesasPorCategoria: [], base: baseFinanceiraVazia(), proximosCompromissos: Array.from({ length: 6 }, (_, index) => compromisso(index + 1)) });
    const onNav = vi.fn();
    render(<VisaoGeralFinanceira onNav={onNav} />);
    await screen.findByText("Compromisso 1");
    expect(within(screen.getByRole("group", { name: "Tipo do gráfico de receitas e despesas" })).getByRole("button", { name: "Linhas" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Compromisso 6")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Registrar pagamento" })[0]);
    expect(screen.getByRole("dialog", { name: "Registrar pagamento" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getAllByRole("button", { name: /Compromisso \d, a pagar/ })).toHaveLength(6);
    expect(obterDashboardFinanceiro).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("heading", { name: "outubro de 2026" })).toBeTruthy();
    expect(obterDashboardFinanceiro).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Compromisso \d, a pagar/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    expect(screen.getByRole("dialog", { name: "Registrar pagamento" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver 6 compromissos" }));
    const dia = screen.getByRole("dialog", { name: "Compromissos de 14/09/2026" });
    expect(dia.querySelectorAll("li button")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(onNav).toHaveBeenCalledWith("gastos");
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenLastCalledWith("2025-01-01", expect.stringContaining("2025-12-31")));
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Ano atual" }));
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenLastCalledWith("2026-01-01", expect.stringContaining("2026-12-31")));
  });

  it("mantém a visão geral somente para consulta sem a permissão de lançar", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([compromisso(1)]);
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [], compromissos: { aPagar: "100", aReceber: "0" }, despesasPorCategoria: [], base: baseFinanceiraVazia(), proximosCompromissos: [compromisso(1)] });
    render(<VisaoGeralFinanceira onNav={vi.fn()} podeLancar={false} />);

    await screen.findByText("Compromisso 1");
    expect(screen.queryByRole("button", { name: "Nova operação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
    // A análise por categorias consulta as opções de filtro; a visão geral não
    // deve fazer uma segunda consulta para preparar a liquidação sem permissão.
    expect(obterConfiguracoesFinanceiras).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Calendário" }));
    fireEvent.click(screen.getByRole("button", { name: /Compromisso 1, a pagar/ }));
    expect(screen.getByRole("dialog", { name: "Detalhes do compromisso" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
  });

  it("recarrega dashboard e compromissos após liquidar pela visão geral", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([compromisso(1)]);
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [], compromissos: { aPagar: "100", aReceber: "0" }, despesasPorCategoria: [], base: baseFinanceiraVazia(), proximosCompromissos: [compromisso(1)] });
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));

    await waitFor(() => expect(liquidarCompromisso).toHaveBeenCalledWith(1, expect.objectContaining({ contaId: 1, valor: 100 })));
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenCalledTimes(2));
    expect(listarCompromissos).not.toHaveBeenCalled();
  });

  it("aplica as abas e o filtro de vencidos ao calendário e mantém a liquidação disponível", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([
      compromisso(1, { vencido: true, status: "PARCIAL", saldoPendente: "50", valorLiquidado: "50", numeroParcela: 1, totalParcelas: 2 }),
      compromisso(2), compromisso(3, { tipo: "RECEBER" }), compromisso(4, { status: "LIQUIDADO", saldoPendente: "0" }), compromisso(5, { status: "CANCELADO" }),
    ]);
    render(<CompromissosFinanceiros onNav={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Calendário" }));
    expect(screen.getAllByRole("button", { name: /Compromisso \d, a pagar/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar somente vencidos" }));
    expect(screen.queryByRole("button", { name: /Compromisso 2, a pagar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Compromisso 1, a pagar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    expect(screen.getByRole("dialog", { name: "Registrar pagamento" }).textContent).toContain("(1/2) Compromisso 1");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar somente vencidos" }));
    fireEvent.click(screen.getByRole("button", { name: "A receber" }));
    expect(screen.getByRole("button", { name: /Compromisso 3, a receber/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Liquidados" }));
    expect(screen.getByRole("button", { name: /Compromisso 4, a pagar/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Compromisso 5/ })).toBeNull();
  });

  it("mantém compromissos somente para consulta sem a permissão de lançar", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([compromisso(1)]);
    render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);

    await screen.findByText("Compromisso 1");
    expect(screen.queryByRole("button", { name: "Criar a receber" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar a pagar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
    expect(obterConfiguracoesFinanceiras).not.toHaveBeenCalled();
  });
});

it("o acesso pela rastreabilidade preserva o período e mostra também compromissos cancelados", async () => {
  window.history.replaceState(null, "", "/financeiro/compromissos?inicio=2026-09-12&fim=2026-09-15&situacao=todos");
  vi.mocked(listarCompromissos).mockResolvedValue([compromisso(1), compromisso(2, { status: "CANCELADO" })]);
  render(<CompromissosFinanceiros onNav={vi.fn()} />);
  await screen.findByText("Compromisso 2");
  expect(listarCompromissos).toHaveBeenCalledWith({ inicio: "2026-09-12", fim: "2026-09-15" });
  expect(screen.getByText("Valor original (cancelado)")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Registrar pagamento" })).toHaveLength(1);
  expect(screen.getByText(/Total pendente:/).textContent).toContain("100,00");
});
