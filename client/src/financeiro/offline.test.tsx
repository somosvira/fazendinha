// @vitest-environment jsdom
// Cobre o contrato offline das telas migradas para useQuery (ver
// docs/design/offline/README.md): dado em cache aparece sem rede, falta de
// cache e rede mostra o aviso — nunca "Carregando…" infinito — e os botões
// de Relatórios que dependem do servidor ficam desabilitados offline.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { baseFinanceiraVazia } from "./dashboard.fixture";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { financeiroKeys } from "./queries";
import { periodoDoAnoAtual } from "./lib/periodo";
import { criarQueryClientTeste, renderComQuery } from "./lib/testQueryClient";
import type { DashboardFinanceiro, RelatorioFinanceiro } from "./novo-api";

vi.mock("./novo-api", () => ({
  obterDashboardFinanceiro: vi.fn(),
  listarCompromissos: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  listarOperacoes: vi.fn().mockResolvedValue([]),
  obterAnaliseCategorias: vi.fn().mockResolvedValue({ total: "0", categorias: [], linhas: [] }),
  obterRascunhoOperacao: vi.fn().mockResolvedValue(null),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
  listarRelatoriosFinanceiros: vi.fn(),
  obterRascunhoRelatorioFinanceiro: vi.fn().mockResolvedValue(null),
  descartarRascunhoRelatorioFinanceiro: vi.fn().mockResolvedValue(undefined),
  salvarPdfRelatorioFinanceiro: vi.fn().mockResolvedValue(undefined),
}));

const dashboardVazio = (): DashboardFinanceiro => ({
  periodo: periodoDoAnoAtual(), saldoGeral: "120", contas: [],
  realizado: { entradas: "0", saidas: "0", resultado: "0" }, fluxo: [], compromissos: { aPagar: "0", aReceber: "0" },
  despesasPorCategoria: [], proximosCompromissos: [], base: baseFinanceiraVazia(),
});

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro");
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true); // nunca deixar um teste offline vazar pro próximo
});

describe("Visão geral — offline", () => {
  it("com dado em cache e sem rede, mostra o dado salvo em vez de carregar", async () => {
    const { obterDashboardFinanceiro } = await import("./novo-api");
    const queryClient = criarQueryClientTeste();
    const { inicio, fim } = periodoDoAnoAtual();
    queryClient.setQueryData(financeiroKeys.dashboard(inicio, fim), dashboardVazio());
    onlineManager.setOnline(false);

    renderComQuery(<VisaoGeralFinanceira onNav={vi.fn()} />, { queryClient });

    expect(await screen.findByText("R$ 120,00")).toBeTruthy();
    expect(screen.queryByText("Carregando financeiro")).toBeNull();
    expect(obterDashboardFinanceiro).not.toHaveBeenCalled();
  });

  it("sem cache e sem rede, mostra o aviso de sem conexão em vez de carregar pra sempre", async () => {
    onlineManager.setOnline(false);
    renderComQuery(<VisaoGeralFinanceira onNav={vi.fn()} />);

    expect(await screen.findByText(/Sem conexão e sem dados salvos/)).toBeTruthy();
    expect(screen.queryByText("Carregando financeiro")).toBeNull();
  });
});

describe("Relatórios — offline", () => {
  const relatorio = (): RelatorioFinanceiro => ({
    id: "r1", nome: "Relatório de teste", status: "CONCLUIDO",
    parametros: { nome: "Relatório de teste", dataInicio: "2026-01-01", dataFim: "2026-01-31", regime: "realizado", tipos: [], status: [], centroCustoIds: [], parceiroIds: [], categoriaIds: [], classificacoes: [] },
    propriedadeId: 1, propriedade: "Fazenda", autor: "Rubens", geradoEm: "2026-01-31T12:00:00Z", concluidoEm: "2026-01-31T12:00:00Z", erro: null,
  });

  it("lista aberta offline: baixar PDF e novo relatório ficam desabilitados", async () => {
    const queryClient = criarQueryClientTeste();
    queryClient.setQueryData(financeiroKeys.relatoriosTodos(), [relatorio()]);
    queryClient.setQueryData(financeiroKeys.configuracoes(), { contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] });
    onlineManager.setOnline(false);

    renderComQuery(<RelatoriosFinanceiros />, { queryClient });

    const baixar = (await screen.findAllByRole("button", { name: /Baixar PDF/ }))[0] as HTMLButtonElement;
    expect(baixar.disabled).toBe(true);
    const novo = screen.getAllByRole("button", { name: /Novo relatório/ })[0] as HTMLButtonElement;
    expect(novo.disabled).toBe(true);
    expect(screen.getAllByText(/Sem conexão/).length).toBeGreaterThan(0);
  });
});
