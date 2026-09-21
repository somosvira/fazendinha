// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import type { Operacao } from "./novo-api";

const { obterOperacao, estornarOperacao, estornarTransacao } = vi.hoisted(() => ({ obterOperacao: vi.fn(), estornarOperacao: vi.fn(), estornarTransacao: vi.fn() }));
vi.mock("./novo-api", () => ({ obterOperacao, estornarOperacao, estornarTransacao }));

const operacao = {
  id: 6, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "360",
  parceiro: { id: 1, nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: 1, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: 1 }],
  transacoes: [{ id: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-02", formaPagamento: "PIX", valorTotal: "360", movimentos: [] }],
  compromissos: [], movimentosEstoque: [{ id: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: 1 }], documentos: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { window.history.replaceState(null, "", "/financeiro/operacoes/6"); });

const contaBanco = { id: 1, nome: "Banco principal" };
const operacaoComResumo: Operacao = {
  id: 6, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "200",
  parceiro: { id: 1, nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: 1, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: 1 }],
  transacoes: [{ id: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-02", formaPagamento: "PIX", valorTotal: "80", movimentos: [] }],
  compromissos: [
    {
      id: 20, tipo: "PAGAR", status: "PARCIAL", valorOriginal: "100", valorLiquidado: "80", saldoPendente: "20", saldoExigivel: "20",
      dataVencimento: "2026-10-01", numeroParcela: 1, totalParcelas: 2, parceiro: null,
      operacao: { id: 6, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" },
      liquidacoes: [{ id: 100, valor: "80", transacao: { id: 9, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-05", formaPagamento: "PIX", valorTotal: "80", movimentos: [{ id: 9, contaId: 1, direcao: "SAIDA", valor: "80", conta: contaBanco }] } }],
    },
    {
      id: 21, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", saldoExigivel: "100",
      dataVencimento: "2026-11-01", numeroParcela: 2, totalParcelas: 2, parceiro: null,
      operacao: { id: 6, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" }, liquidacoes: [],
    },
  ],
  movimentosEstoque: [{ id: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: 1 }],
  documentos: [],
  resumoCancelamento: {
    compromissos: [
      { id: 20, numeroParcela: 1, status: "PARCIAL", valorOriginal: "100", valorLiquidado: "80", saldoExigivel: "20" },
      { id: 21, numeroParcela: 2, status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoExigivel: "100" },
    ],
    transacoes: [{ id: 1, tipo: "PAGAMENTO", data: "2026-09-02", valorTotal: "80", movimentos: [{ id: 5, contaId: 1, conta: contaBanco, direcao: "SAIDA", valor: "80", direcaoInversa: "ENTRADA" }] }],
    estoque: [{ id: 1, produtoId: 1, produtoNome: "Ração", quantidade: "30", unidade: "kg", tipo: "ENTRADA" }],
    impactosPorConta: [{ conta: contaBanco, entrada: "80", saida: "0" }],
    documentosPreservados: 0,
  },
};

describe("OperacaoFinanceiraDetalhe", () => {
  it("abre uma página própria e revisa os efeitos antes de cancelar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    estornarOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA" });
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
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
});

describe("OperacaoFinanceiraDetalhe — detalhe da parcela", () => {
  it("mostra valor/pago/restante e o link da conta abre o movimento correspondente no extrato", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);

    const semNbsp = (texto: string | null | undefined) => texto?.replaceAll(" ", " ");
    const dialog = within(screen.getByRole("dialog", { name: "Detalhe da parcela" }));
    expect(semNbsp(dialog.getByText("Valor da parcela").nextElementSibling?.textContent)).toBe("R$ 100,00");
    expect(semNbsp(dialog.getByText("Pago").nextElementSibling?.textContent)).toBe("R$ 80,00");
    expect(semNbsp(dialog.getByText("Restante").nextElementSibling?.textContent)).toBe("R$ 20,00");

    fireEvent.click(dialog.getByRole("button", { name: "Banco principal" }));
    expect(window.location.pathname + window.location.hash).toBe("/financeiro/contas/1#movimento-9");
  });

  it("parcela pendente informa que ainda não há pagamento ou recebimento registrado", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(2\/2\) Compra de ração/).closest("button")!);
    const dialog = within(screen.getByRole("dialog", { name: "Detalhe da parcela" }));
    expect(dialog.getByText(/ainda não tem pagamento ou recebimento registrado/)).toBeTruthy();
    expect(dialog.queryByRole("button", { name: /Estornar/ })).toBeNull();
  });

  it("estorna a liquidação com motivo e fecha o detalhe após recarregar", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    estornarTransacao.mockResolvedValue({});
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Detalhe da parcela" })).getByRole("button", { name: "Estornar pagamento" }));

    const estorno = within(screen.getByRole("dialog", { name: "Estornar liquidação" }));
    const confirmar = estorno.getByRole("button", { name: "Confirmar estorno" });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(estorno.getByLabelText("Motivo do estorno"), { target: { value: "Pagamento em duplicidade" } });
    fireEvent.click(confirmar);

    await waitFor(() => expect(estornarTransacao).toHaveBeenCalledWith(9, "Pagamento em duplicidade"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Detalhe da parcela" })).toBeNull());
    expect(obterOperacao).toHaveBeenCalledTimes(2); // recarrega a operação após o estorno
  });

  it("sem permissão de lançar, não oferece a ação de estornar", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar={false} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);
    expect(within(screen.getByRole("dialog", { name: "Detalhe da parcela" })).queryByRole("button", { name: /Estornar/ })).toBeNull();
  });
});

describe("OperacaoFinanceiraDetalhe — revisão do cancelamento", () => {
  it("lista os movimentos de estoque com produto/quantidade/unidade reais e o impacto líquido por conta", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={6} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));

    const dialog = within(screen.getByRole("dialog", { name: "Cancelar operação" }));
    expect(dialog.getByText(/Reverter entrada de 30 kg de Ração/)).toBeTruthy();
    expect(dialog.getByText(/Banco principal: impacto no saldo \+R\$\s?80,00/)).toBeTruthy();
  });
});
