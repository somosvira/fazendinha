// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { baseFinanceiraVazia } from "./dashboard.fixture";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("./novo-api", () => ({
  obterDashboardFinanceiro: vi.fn().mockResolvedValue({
    periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "0", contas: [],
    realizado: { entradas: "0", saidas: "0", resultado: "0" }, fluxo: [], compromissos: { aPagar: "0", aReceber: "0" }, despesasPorCategoria: [], base: baseFinanceiraVazia(), proximosCompromissos: [],
  }),
  listarCompromissos: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  listarOperacoes: vi.fn().mockResolvedValue([]),
  obterAnaliseCategorias: vi.fn().mockResolvedValue({ total: "0", categorias: [], linhas: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
}));

const rascunho = { id: uid(8), versao: 1, updatedAt: "2026-09-14T12:00:00Z", documentos: [], dados: {} };

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro");
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("VisaoGeralFinanceira — nova operação", () => {
  it("abre o formulário direto quando não existe rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(null);
    const onNav = vi.fn();
    render(<VisaoGeralFinanceira onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));

    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
    expect(screen.queryByRole("heading", { name: "Criar uma nova operação?" })).toBeNull();
  });

  it("pede confirmação e oferece voltar ao rascunho atual sem descartá-lo", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(rascunho);
    const onNav = vi.fn();
    render(<VisaoGeralFinanceira onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    expect(await screen.findByRole("heading", { name: "Criar uma nova operação?" })).toBeTruthy();
    expect(onNav).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ver rascunho atual" }));
    expect(onNav).toHaveBeenCalledWith("lancar");
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("descarta o rascunho só depois de confirmado", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(rascunho);
    const onNav = vi.fn();
    render(<VisaoGeralFinanceira onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Criar mesmo assim" }));

    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
  });
});

import { obterDashboardFinanceiro, listarOperacoes, type DashboardFinanceiro } from "./novo-api";
import { act } from "@testing-library/react";

describe("Visão geral — período global", () => {
  it("recarrega toda a visão em uma consulta, preserva os dados anteriores durante a atualização e ignora respostas atrasadas", async () => {
    const snapshot = (total: string): DashboardFinanceiro => ({ periodo: { inicio: "2026-01-01", fim: "2026-12-31" }, saldoGeral: "0", contas: [], realizado: { entradas: total, saidas: "0", resultado: total }, fluxo: [], compromissos: { aPagar: "0", aReceber: "0" }, despesasPorCategoria: [], proximosCompromissos: [], base: { ...baseFinanceiraVazia(), volumeEconomico: total, porTipo: [{ tipo: "VENDA", valor: total }] } });
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce(snapshot("321"));
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compromissos" });
    expect(screen.queryByRole("heading", { name: "Despesas realizadas" })).toBeNull();
    expect(listarOperacoes).not.toHaveBeenCalled();
    const headings = Array.from(document.querySelectorAll("h2")).map(h => h.textContent);
    expect(headings.filter(h => ["Compromissos", "Recebimentos e pagamentos", "Contas e disponibilidade", "Despesas por categoria"].includes(h!))).toEqual(["Recebimentos e pagamentos", "Contas e disponibilidade", "Compromissos", "Despesas por categoria"]);
    let resolveOld!: (value: DashboardFinanceiro) => void;
    vi.mocked(obterDashboardFinanceiro).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: /^Período:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(screen.getAllByText("R$ 321,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Atualizando… Os dados anteriores/)).toBeTruthy();
    expect(document.querySelector("[aria-busy=true][inert]")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Base financeira" })).toBeNull();
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce(snapshot("876"));
    fireEvent.click(screen.getByRole("button", { name: /^Período:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    await screen.findAllByText("R$ 876,00");
    await act(async () => resolveOld(snapshot("999")));
    expect(screen.queryByText("R$ 999,00")).toBeNull();
    expect(screen.getAllByText("R$ 876,00").length).toBeGreaterThan(0);
    expect(obterDashboardFinanceiro).toHaveBeenCalledTimes(3);
  });
  it("mostra erro e permite tentar novamente sem restaurar o período antigo", async () => {
    vi.mocked(obterDashboardFinanceiro).mockRejectedValueOnce(new Error("Falha de rede"));
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falha de rede");
    expect(screen.queryByRole("heading", { name: "Base financeira" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("heading", { name: "Compromissos" });
  });
});


describe("Visão geral — grid operacional", () => {
  it("remove rastreabilidade e volume e abre calendário em modal", async () => {
    render(<VisaoGeralFinanceira onNav={vi.fn()} podeLancar={false} />);
    await screen.findByRole("heading", { name: "Compromissos" });
    expect(screen.queryByText("Rastreabilidade e integridade")).toBeNull();
    expect(screen.queryByText("Sem movimento de conta")).toBeNull();
    expect(screen.queryByText("Volume por tipo de operação")).toBeNull();
    expect(screen.queryByRole("button", { name: "Nova operação" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expandir calendário" }));
    expect(screen.getByRole("dialog", { name: "Calendário de compromissos" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("soma vencidos além das cinco linhas visíveis e usa resultado líquido da API", async () => {
    const compromisso = (i: number) => ({ id: uid(i + 100), seq: i, tipo: "PAGAR" as const, status: "PARCIAL", saldoPendente: "0.10", valorOriginal: "20", valorLiquidado: "19.90", dataVencimento: "2026-01-01", numeroParcela: 1, totalParcelas: 1, vencido: true, parceiro: null, operacao: { id: uid(i + 200), numero: i, tipo: "SERVICO", descricao: `Serviço ${i}` } });
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce({ periodo: { inicio: "2026-01-01", fim: "2026-12-31" }, saldoGeral: "0", contas: [], realizado: { entradas: "10", saidas: "12.33", resultado: "-2.33" }, fluxo: [], compromissos: { aPagar: "0.60", aReceber: "0" }, despesasPorCategoria: [], proximosCompromissos: Array.from({ length: 6 }, (_, i) => compromisso(i)), base: baseFinanceiraVazia() });
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    expect(await screen.findByText(/Vencido:.*0,60.*6 itens/)).toBeTruthy();
    expect(screen.getByText(/-R\$.*2,33/)).toBeTruthy();
    expect(screen.getByRole("table", { name: "Compromissos do período" }).querySelectorAll("tbody tr")).toHaveLength(5);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Próximos 7 dias/ }), { button: 0, ctrlKey: false });
    expect(screen.getByText(/Nenhum compromisso nos próximos 7 dias/)).toBeTruthy();
  });
});

it("integra os indicadores aos painéis e abre lista sem navegar", async () => {
  render(<VisaoGeralFinanceira onNav={vi.fn()} />);
  const pagar = await screen.findByRole("button", { name: "Ver a pagar" });
  expect(screen.getAllByText(/^Saldo disponível ·/)).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Ver recebimentos" }).closest(".fin-painel")?.textContent).toContain("Recebimentos e pagamentos");
  const caminho = window.location.pathname;
  fireEvent.click(pagar);
  expect(await screen.findByRole("dialog", { name: "Compromissos a pagar" })).toBeTruthy();
  expect(window.location.pathname).toBe(caminho);
});
