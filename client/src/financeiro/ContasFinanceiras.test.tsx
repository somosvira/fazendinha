// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { obterConfiguracoesFinanceiras, obterExtratoConta } from "./novo-api";

vi.mock("./novo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  obterConfiguracoesFinanceiras: vi.fn(),
  obterExtratoConta: vi.fn(),
  transferir: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterExtratoConta).mockResolvedValue([]);
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
    contas: [
      { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: 2, nome: "Caixa auxiliar", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "50", dataSaldoAbertura: "2026-09-01", saldoAtual: "50", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
      { id: 3, nome: "Conta inativa", tipo: "APLICACAO", instituicao: null, identificacao: null, saldoAbertura: "20", dataSaldoAbertura: "2026-09-01", saldoAtual: "20", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
    ],
    parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [],
  });
});

afterEach(cleanup);

describe("ContasFinanceiras — cadastros ativos", () => {
  it("não oferece conta inativa na transferência", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);

    expect((await screen.findAllByText("Banco principal")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Conta inativa")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    expect(await screen.findByRole("heading", { name: "Nova transferência" })).toBeTruthy();
    expect(screen.getAllByRole("option", { name: /Banco principal/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: /Caixa auxiliar/ }).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("dialog")).queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
  it("permite consultar o histórico de uma conta inativa", async () => {
    render(<ContasFinanceiras onNav={vi.fn()} />);
    const seletor = await screen.findByLabelText("Conta para consultar extrato");
    fireEvent.change(seletor, { target: { value: "3" } });
    await waitFor(() => expect(obterExtratoConta).toHaveBeenLastCalledWith(3));
    expect(screen.getByRole("heading", { name: "Conta inativa" })).toBeTruthy();
  });
});
