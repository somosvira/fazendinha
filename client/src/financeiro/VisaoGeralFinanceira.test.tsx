// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";

vi.mock("./novo-api", () => ({
  obterDashboardFinanceiro: vi.fn().mockResolvedValue({
    periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "0", contas: [],
    realizado: { entradas: "0", saidas: "0", resultado: "0" }, compromissos: { aPagar: "0", aReceber: "0" }, despesasPorCategoria: [],
  }),
  listarCompromissos: vi.fn().mockResolvedValue([]),
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
