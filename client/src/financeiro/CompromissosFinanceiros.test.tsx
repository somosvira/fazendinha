// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("./novo-api", () => ({
  listarCompromissos: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
  liquidarCompromisso: vi.fn(),
}));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, "", "/financeiro/compromissos");
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("CompromissosFinanceiros — criação", () => {
  it("pede confirmação antes de substituir um rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue({ id: uid(8), versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} });
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a pagar" }));
    expect(await screen.findByRole("heading", { name: "Criar um novo valor a pagar?" })).toBeTruthy();
    expect(screen.getByText(/Você já tem um rascunho de operação em andamento/)).toBeTruthy();
    expect(screen.getByText(/dados preenchidos e documentos anexados serão excluídos permanentemente/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver rascunho atual" }).className).toContain("bg-green-50");
    expect(screen.getByRole("button", { name: "Criar mesmo assim" }).className).toContain("bg-destructive");
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Criar mesmo assim" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
  });

  it("segue diretamente quando não existe rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(null);
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    expect(window.location.pathname + window.location.search).toBe("/financeiro/operacoes/nova?compromisso=RECEBER");
    expect(screen.queryByRole("heading", { name: /Criar um novo valor/ })).toBeNull();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("abre o rascunho atual sem descartar seus dados", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue({ id: uid(8), versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} });
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    expect(await screen.findByRole("heading", { name: "Criar um novo valor a receber?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver rascunho atual" }));

    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/financeiro/operacoes/nova"));
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("não oferece conta inativa ao liquidar um compromisso", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([{
      id: uid(11),
      seq: 11,
      tipo: "PAGAR",
      status: "PENDENTE",
      valorOriginal: "100",
      valorLiquidado: "0",
      saldoPendente: "100",
      dataVencimento: "2026-09-30",
      numeroParcela: 1,
      totalParcelas: 2,
      vencido: false,
      parceiro: null,
      operacao: { id: uid(5), numero: 5, tipo: "SERVICO", descricao: "Serviço veterinário" },
    }]);
    vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
      contas: [
        { id: uid(1), nome: "Conta ativa", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
        { id: uid(2), nome: "Conta inativa", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
      ],
      parceiros: [], categorias: [], centrosCusto: [], produtos: [],
    });
    render(<CompromissosFinanceiros onNav={vi.fn()} />);

    expect(await screen.findByText("(1/2) Serviço veterinário")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar pagamento" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Conta" }), { key: "Enter" });
    expect(await screen.findByRole("option", { name: /Conta ativa/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
});
