// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";

const { obterOperacao, estornarOperacao } = vi.hoisted(() => ({ obterOperacao: vi.fn(), estornarOperacao: vi.fn() }));
vi.mock("./novo-api", () => ({ obterOperacao, estornarOperacao }));

const OPERACAO_ID = "00000000-0000-4000-8000-000000000006";
const PARCEIRO_ID = "00000000-0000-4000-8000-000000000001";
const ITEM_ID = "00000000-0000-4000-8000-000000000002";
const PRODUTO_ID = "00000000-0000-4000-8000-000000000003";
const TRANSACAO_ID = "00000000-0000-4000-8000-000000000004";
const MOVIMENTO_ID = "00000000-0000-4000-8000-000000000005";

const operacao = {
  id: OPERACAO_ID, numero: 6, registradoEm: "2026-09-02T12:00:00Z", tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "360",
  parceiro: { id: PARCEIRO_ID, nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: ITEM_ID, ordem: 0, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: PRODUTO_ID }],
  transacoes: [{ id: TRANSACAO_ID, tipo: "PAGAMENTO", status: "CONFIRMADA", valorTotal: "360", movimentos: [] }],
  compromissos: [], movimentosEstoque: [{ id: MOVIMENTO_ID, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: PRODUTO_ID }], documentos: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("OperacaoFinanceiraDetalhe", () => {
  it("abre uma página própria e revisa os efeitos antes de cancelar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    estornarOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA" });
    render(<OperacaoFinanceiraDetalhe operacaoId={OPERACAO_ID} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Compra de ração" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));
    expect(screen.getByText(/Reverter 1 movimento de estoque/)).toBeTruthy();
    expect(screen.getByText(/Estornar 1 transação financeira/)).toBeTruthy();
    const confirmar = screen.getByRole("button", { name: "Confirmar cancelamento" });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Nota fiscal incorreta" } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(estornarOperacao).toHaveBeenCalledWith(OPERACAO_ID, "Nota fiscal incorreta"));
  });
});
