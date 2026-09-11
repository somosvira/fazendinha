// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao } from "./novo-api";

vi.mock("./novo-api", () => ({
  listarCompromissos: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
  liquidarCompromisso: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro/compromissos");
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("CompromissosFinanceiros — criação", () => {
  it("pede confirmação antes de substituir um rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue({ id: 8, versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} });
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a pagar" }));
    expect(await screen.findByRole("heading", { name: "Substituir rascunho em andamento?" })).toBeTruthy();
    expect(screen.getByText(/dados preenchidos e documentos anexados/)).toBeTruthy();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar e continuar" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
  });

  it("segue diretamente quando não existe rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(null);
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    expect(screen.queryByRole("heading", { name: "Substituir rascunho em andamento?" })).toBeNull();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("não oferece conta inativa ao liquidar um compromisso", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([{
      id: 11,
      tipo: "PAGAR",
      status: "PENDENTE",
      valorOriginal: "100",
      valorLiquidado: "0",
      saldoPendente: "100",
      dataVencimento: "2026-09-30",
      vencido: false,
      parceiro: null,
      operacao: { id: 5, tipo: "SERVICO", descricao: "Serviço veterinário" },
    }]);
    vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
      contas: [
        { id: 1, nome: "Conta ativa", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
        { id: 2, nome: "Conta inativa", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
      ],
      parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [],
    });
    render(<CompromissosFinanceiros onNav={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Registrar pagamento" }));
    expect(await screen.findByRole("option", { name: /Conta ativa/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
});
