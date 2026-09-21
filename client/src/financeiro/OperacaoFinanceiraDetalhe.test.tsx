// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";

const { obterOperacao, estornarOperacao, estornarTransacao } = vi.hoisted(() => ({ obterOperacao: vi.fn(), estornarOperacao: vi.fn(), estornarTransacao: vi.fn() }));
vi.mock("./novo-api", () => ({ obterOperacao, estornarOperacao, estornarTransacao }));

const operacao = {
  id: 6, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "360",
  parceiro: { id: 1, nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: 1, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: 1 }],
  transacoes: [{ id: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", valorTotal: "360", movimentos: [] }],
  compromissos: [], movimentosEstoque: [{ id: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: 1 }], documentos: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("OperacaoFinanceiraDetalhe", () => {
  it("abre uma página própria e revisa os efeitos antes de cancelar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    estornarOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA" });
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar />);
    expect(await screen.findByRole("heading", { name: "Compra de ração" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));
    expect(screen.getByText(/Reverter 1 movimento de estoque/)).toBeTruthy();
    expect(screen.getByText(/Estornar 1 transação financeira/)).toBeTruthy();
    const confirmar = screen.getByRole("button", { name: "Confirmar cancelamento" });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Nota fiscal incorreta" } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(estornarOperacao).toHaveBeenCalledWith(6, "Nota fiscal incorreta"));
  });

  it("não oferece ações destrutivas sem a permissão de lançar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar={false} />);
    expect(await screen.findByRole("heading", { name: "Compra de ração" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar operação" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Estornar pagamento/ })).toBeNull();
  });

  it("não anuncia reversão física para movimentos já estornados", async () => {
    obterOperacao.mockResolvedValue({ ...operacao, movimentosEstoque: [
      { ...operacao.movimentosEstoque[0], status: "REVERTIDO", revertidoPor: { id: 2 } },
      { ...operacao.movimentosEstoque[0], id: 2, tipo: "SAIDA", reversaoDeId: 1 },
    ] });
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar operação" }));
    expect(screen.queryByText(/Reverter .* movimento.* de estoque/)).toBeNull();
  });
});
