// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { liquidarCompromisso, listarCompromissos, obterConfiguracoesFinanceiras, obterDashboardFinanceiro, obterExtratoConta, obterExtratoGeral, type Compromisso, type Conta, type MovimentoGeral } from "./novo-api";
import { escolher, escolherData, prepararPopups } from "./campos.test-utils";

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
  prepararPopups();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  window.history.replaceState(null, "", "/financeiro/contas");
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas, parceiros: [], categorias: [], centrosCusto: [], produtos: [] });
  vi.mocked(obterExtratoGeral).mockResolvedValue(movimentos);
  vi.mocked(obterExtratoConta).mockImplementation(async id => movimentos.filter(m => m.contaId === id));
  vi.mocked(liquidarCompromisso).mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const total = (titulo: string) => screen.getByText(titulo).parentElement!.textContent!.replace(/\s/g, " ");

describe("visualizações financeiras integradas", () => {
  it("mantém o gráfico alinhado aos filtros do extrato geral, não aos da listagem", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    await waitFor(() => expect(total("Receitas no período")).toContain("R$ 160,00"));
    expect(total("Despesas no período")).toContain("R$ 65,00");
    expect(screen.getByRole("combobox", { name: "Intervalo do gráfico" }).textContent).toBe("Este ano (2026)");
    expect(screen.getByRole("button", { name: "Mês inicial do gráfico" }).textContent).toBe("jan/2026");
    expect(screen.getByRole("button", { name: "Mês final do gráfico" }).textContent).toBe("dez/2026");
    expect(screen.getByRole("button", { name: "Linhas" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Barras" }));
    expect(screen.getByRole("button", { name: "Barras" }).getAttribute("aria-pressed")).toBe("true");
    await escolher("Intervalo do gráfico", "3 meses");
    expect(screen.getByRole("button", { name: "Mês inicial do gráfico" }).textContent).toBe("jul/2026");
    expect(screen.getByRole("button", { name: "Mês final do gráfico" }).textContent).toBe("set/2026");
    await escolher("Intervalo do gráfico", "1 mês");
    expect(obterExtratoGeral).toHaveBeenCalledOnce();
    await escolher("Tipo", "Caixa");
    expect(total("Receitas no período")).toContain("R$ 160,00");
    expect(total("Despesas no período")).toContain("R$ 65,00");
    const secaoExtrato = screen.getByRole("heading", { name: "Extrato geral" }).closest("section")!;
    await escolher("Instituição", "Sem instituição", within(secaoExtrato));
    expect(total("Receitas no período")).toContain("R$ 0,00");
    expect(total("Despesas no período")).toContain("R$ 25,00");
    await escolherData("Data inicial", "15 de setembro de 2026", within(secaoExtrato));
    expect(screen.getByText("Sem movimentações no período selecionado para este escopo.")).toBeTruthy();
    fireEvent.click(within(secaoExtrato).getByRole("button", { name: "Limpar datas" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo período do gráfico" }));
    expect(screen.getByText("Sem movimentações no período selecionado para este escopo.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Entradas e saídas por dia/ })).toBeNull();
  });

  it("explica cada atalho de intervalo do gráfico", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    fireEvent.click(await screen.findByRole("combobox", { name: "Intervalo do gráfico" }));
    expect((await screen.findByRole("option", { name: "3 meses" })).textContent).toContain("Os últimos 3 meses, contando o atual");
    expect(screen.getByRole("option", { name: "Personalizado" }).textContent).toContain("mês inicial e o mês final");
    expect(screen.getByRole("option", { name: "Este ano (2026)" }).textContent).toContain("De janeiro a dezembro de 2026");
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
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [{ data: "2026-09-14", entradas: "120", saidas: "25" }], compromissos: { aPagar: "600", aReceber: "0" }, despesasPorCategoria: [] });
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
    await escolher("Intervalo do gráfico", "Ano passado (2025)");
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenLastCalledWith("2025-01-01", expect.stringContaining("2025-12-31")));
    await escolher("Intervalo do gráfico", "Este ano (2026)");
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenLastCalledWith("2026-01-01", expect.stringContaining("2026-12-31")));
  });

  it("mantém a visão geral somente para consulta sem a permissão de lançar", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([compromisso(1)]);
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [], compromissos: { aPagar: "100", aReceber: "0" }, despesasPorCategoria: [] });
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
    vi.mocked(obterDashboardFinanceiro).mockResolvedValue({ periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "120", contas, realizado: { entradas: "120", saidas: "25", resultado: "95" }, fluxo: [], compromissos: { aPagar: "100", aReceber: "0" }, despesasPorCategoria: [] });
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Registrar pagamento" }));
    await escolher("Conta", /Banco/);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));

    await waitFor(() => expect(liquidarCompromisso).toHaveBeenCalledWith(1, expect.objectContaining({ contaId: 1, valor: 100 })));
    await waitFor(() => expect(obterDashboardFinanceiro).toHaveBeenCalledTimes(2));
    expect(listarCompromissos).toHaveBeenCalledTimes(2);
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
