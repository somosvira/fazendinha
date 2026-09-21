// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { baseFinanceiraVazia } from "./dashboard.fixture";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";

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

const rascunho = { id: 8, versao: 1, updatedAt: "2026-09-14T12:00:00Z", documentos: [], dados: {} };

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
  it("recarrega toda a visão em uma consulta, esconde os dados anteriores e ignora respostas atrasadas", async () => {
    const snapshot = (total: string): DashboardFinanceiro => ({ periodo: { inicio: "2026-01-01", fim: "2026-12-31" }, saldoGeral: "0", contas: [], realizado: { entradas: total, saidas: "0", resultado: total }, fluxo: [], compromissos: { aPagar: "0", aReceber: "0" }, despesasPorCategoria: [], proximosCompromissos: [], base: { ...baseFinanceiraVazia(), volumeEconomico: total, porTipo: [{ tipo: "VENDA", valor: total }] } });
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce(snapshot("321"));
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    await screen.findByRole("heading", { name: "Base financeira" });
    expect(screen.queryByRole("heading", { name: "Despesas realizadas" })).toBeNull();
    expect(listarOperacoes).not.toHaveBeenCalled();
    const headings = Array.from(document.querySelectorAll("h2")).map(h => h.textContent);
    expect(headings.filter(h => ["Próximos compromissos", "Base financeira", "Receitas e despesas", "Contas e disponibilidade", "Despesas por categoria"].includes(h!))).toEqual(["Próximos compromissos", "Base financeira", "Receitas e despesas", "Contas e disponibilidade", "Despesas por categoria"]);
    let resolveOld!: (value: DashboardFinanceiro) => void;
    vi.mocked(obterDashboardFinanceiro).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(screen.queryByText("R$ 321,00")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Base financeira" })).toBeNull();
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce(snapshot("876"));
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    await screen.findAllByText("R$ 876,00");
    await act(async () => resolveOld(snapshot("999")));
    expect(screen.queryByText("R$ 999,00")).toBeNull();
    expect(screen.getAllByText("R$ 876,00").length).toBeGreaterThan(0);
    expect(obterDashboardFinanceiro).toHaveBeenCalledTimes(3);
  });
  it("linka \"sem efeitos vinculados\" da Base financeira para Operações filtradas, no mesmo período", async () => {
    vi.mocked(obterDashboardFinanceiro).mockResolvedValueOnce({
      periodo: { inicio: "2026-01-01", fim: "2026-12-31" }, saldoGeral: "0", contas: [],
      realizado: { entradas: "0", saidas: "0", resultado: "0" }, fluxo: [], compromissos: { aPagar: "0", aReceber: "0" },
      despesasPorCategoria: [], proximosCompromissos: [],
      base: { ...baseFinanceiraVazia(), operacoes: { total: 5, estados: {}, comEstoque: 0, semParceiro: 1, semEfeitos: 3 } },
    });
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    const linha = (await screen.findByText(/Sem efeitos vinculados/)).closest("p")!;
    const link = within(linha).getByRole("link");
    expect(link.textContent).toBe("3");
    expect(link.getAttribute("href")).toBe("/financeiro/operacoes?inicio=2026-01-01&fim=2026-12-31&efeito=SEM_EFEITOS");
  });
  it("mostra erro e permite tentar novamente sem restaurar o período antigo", async () => {
    vi.mocked(obterDashboardFinanceiro).mockRejectedValueOnce(new Error("Falha de rede"));
    render(<VisaoGeralFinanceira onNav={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falha de rede");
    expect(screen.queryByRole("heading", { name: "Base financeira" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("heading", { name: "Base financeira" });
  });
});
