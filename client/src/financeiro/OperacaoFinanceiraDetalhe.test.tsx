// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import type { Operacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";
import * as escopo from "../propriedadeScope";

const { obterOperacao, estornarOperacao, estornarTransacao } = vi.hoisted(() => ({ obterOperacao: vi.fn(), estornarOperacao: vi.fn(), estornarTransacao: vi.fn() }));
vi.mock("./novo-api", () => ({ obterOperacao, estornarOperacao, estornarTransacao }));

const operacao = {
  id: uid(6), numero: 6, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "360",
  parceiro: { id: uid(1), nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: uid(1), ordem: 1, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: uid(1) }],
  transacoes: [{ id: uid(1), seq: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-02", formaPagamento: "PIX", valorTotal: "360", movimentos: [] }],
  compromissos: [], movimentosEstoque: [{ id: uid(1), seq: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: uid(1) }], documentos: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
beforeEach(() => { window.history.replaceState(null, "", `/financeiro/operacoes/${uid(6)}`); });

const contaBanco = { id: uid(1), nome: "Banco principal" };
const operacaoComResumo: Operacao = {
  id: uid(6), numero: 6, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração", valorTotal: "200",
  parceiro: { id: uid(1), nome: "Cooperativa", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
  itens: [{ id: uid(1), ordem: 1, descricao: "Ração", quantidade: "30", unidade: "kg", valorUnitario: "12", valorTotal: "360", estocavel: true, produtoId: uid(1) }],
  transacoes: [{ id: uid(1), seq: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-02", formaPagamento: "PIX", valorTotal: "80", movimentos: [] }],
  compromissos: [
    {
      id: uid(20), seq: 20, tipo: "PAGAR", status: "PARCIAL", valorOriginal: "100", valorLiquidado: "80", saldoPendente: "20", saldoExigivel: "20",
      dataVencimento: "2026-10-01", numeroParcela: 1, totalParcelas: 2, parceiro: null,
      operacao: { id: uid(6), numero: 6, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" },
      liquidacoes: [{ id: uid(100), valor: "80", transacao: { id: uid(9), seq: 9, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-05", formaPagamento: "PIX", valorTotal: "80", movimentos: [{ id: uid(9), seq: 9, contaId: uid(1), direcao: "SAIDA", valor: "80", conta: contaBanco }] } }],
    },
    {
      id: uid(21), seq: 21, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", saldoExigivel: "100",
      dataVencimento: "2026-11-01", numeroParcela: 2, totalParcelas: 2, parceiro: null,
      operacao: { id: uid(6), numero: 6, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" }, liquidacoes: [],
    },
  ],
  movimentosEstoque: [{ id: uid(1), seq: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "30", valorTotal: "360", produtoId: uid(1) }],
  documentos: [],
  resumoCancelamento: {
    compromissos: [
      { id: uid(20), numeroParcela: 1, status: "PARCIAL", valorOriginal: "100", valorLiquidado: "80", saldoExigivel: "20" },
      { id: uid(21), numeroParcela: 2, status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoExigivel: "100" },
    ],
    transacoes: [{ id: uid(1), seq: 1, tipo: "PAGAMENTO", data: "2026-09-02", valorTotal: "80", movimentos: [{ id: uid(5), seq: 5, contaId: uid(1), conta: contaBanco, direcao: "SAIDA", valor: "80", direcaoInversa: "ENTRADA" }] }],
    estoque: [{ id: uid(1), produtoId: uid(1), produtoNome: "Ração", quantidade: "30", unidade: "kg", tipo: "ENTRADA" }],
    impactosPorConta: [{ conta: contaBanco, entrada: "80", saida: "0" }],
    documentosPreservados: 0,
  },
};

describe("OperacaoFinanceiraDetalhe", () => {
  const transferencia = {
    ...operacao, tipo: "TRANSFERENCIA_ESTOQUE", descricao: "Reposição entre sítios", valorTotal: "24", itens: [], transacoes: [],
    transferencias: [{ produtoId: uid(1), produtoNome: "Vacina V3", quantidade: "2", unidade: "mL", motivo: "Reposição entre sítios", custoUnitario: "12", valorTotal: "24",
      origem: { id: uid(31), seq: 31, tipo: "SAIDA", status: "CONFIRMADO", data: "2026-10-04", reversaoDeId: null, sitio: { id: 3, nome: "Rio Novo" }, reversao: null, lotes: [{ id: uid(9), partidaId: uid(9), nome: "Vacina outubro", codigo: "VAC-01", validade: "2026-12-31", quantidade: "2" }] },
      destino: { id: uid(32), seq: 32, tipo: "ENTRADA", status: "CONFIRMADO", data: "2026-10-04", reversaoDeId: null, sitio: { id: 4, nome: "Serra" }, reversao: null, lotes: [] },
    }], movimentosEstoque: [{ ...operacao.movimentosEstoque[0], id: uid(31), tipo: "SAIDA" }, { ...operacao.movimentosEstoque[0], id: uid(32) }],
  };
  it("detalha um deslocamento com Produto, origem/destino, lotes e movimentos exatos", async () => {
    obterOperacao.mockResolvedValue(transferencia);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    expect(await screen.findByText("2 mL transferidos")).toBeTruthy();
    expect(screen.getByText("Origem: Rio Novo")).toBeTruthy(); expect(screen.getByText("Destino: Serra")).toBeTruthy();
    expect(screen.getByText(/Vacina outubro/).closest("li")?.textContent).toMatch(/2 mL · Validade 31\/12\/2026/);
    expect(screen.getByRole("link", { name: "Saída #31 · Confirmada" }).getAttribute("href")).toBe(`/estoque?movimentoId=${uid(31)}&propriedadeId=3`);
    expect(screen.getByRole("link", { name: "Entrada #32 · Confirmada" }).getAttribute("href")).toBe(`/estoque?movimentoId=${uid(32)}&propriedadeId=4`);
    expect(screen.getByText("Deslocamentos de estoque").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByRole("heading", { name: "Valor do estoque transferido" })).toBeTruthy();
    expect(screen.getByText(/Não gera pagamento nem nova despesa financeira/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));
    const dialog = within(screen.getByRole("dialog", { name: "Cancelar operação" }));
    expect(dialog.getByText(/Reverter 1 deslocamento de estoque/)).toBeTruthy();
    expect(dialog.queryByText(/Reverter 2 movimentos de estoque/)).toBeNull();
  });
  it("cancelada preserva originais e links das reversões, sem custo ou correção comum", async () => {
    const t = transferencia.transferencias[0];
    obterOperacao.mockResolvedValue({ ...transferencia, status: "CANCELADA", valorTotal: null, transferencias: [{ ...t, valorTotal: null, custoUnitario: null,
      origem: { ...t.origem, status: "REVERTIDO", reversao: { id: uid(41), seq: 41, data: "2026-10-06", tipo: "ENTRADA", status: "CONFIRMADO", reversaoDeId: uid(31) } },
      destino: { ...t.destino, status: "REVERTIDO", reversao: { id: uid(42), seq: 42, data: "2026-10-06", tipo: "SAIDA", status: "CONFIRMADO", reversaoDeId: uid(32) } },
    }] });
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByText("2 mL transferidos");
    expect(screen.getByRole("link", { name: "Reversão #41 da movimentação #31" }).getAttribute("href")).toBe(`/estoque?movimentoId=${uid(41)}&propriedadeId=3`);
    expect(screen.getByRole("link", { name: "Reversão #42 da movimentação #32" }).getAttribute("href")).toBe(`/estoque?movimentoId=${uid(42)}&propriedadeId=4`);
    expect(screen.queryByText(/R\$/)).toBeNull(); expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
  });
  it("orienta seleção de sítio para o destino sem ampliar o escopo ativo", async () => {
    vi.spyOn(escopo, "getPropriedadeAtiva").mockReturnValue(3);
    obterOperacao.mockResolvedValue(transferencia);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    expect(await screen.findByText("Para abrir estas movimentações, selecione o sítio Serra ou a visão consolidada.")).toBeTruthy();
    expect(screen.queryByText(/selecione o sítio Rio Novo/)).toBeNull();
    expect(escopo.getPropriedadeAtiva()).toBe(3);
  });
  it("ignora resposta antiga ao navegar para outra operação e preserva rótulo de retorno", async () => {
    let liberar!: (dados: unknown) => void;
    obterOperacao.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; })).mockResolvedValueOnce(transferencia);
    const props = { onVoltar: vi.fn(), onAbrir: vi.fn(), onCorrigir: vi.fn(), rotuloVoltar: "Voltar à Sanidade" };
    const tela = render(<OperacaoFinanceiraDetalhe {...props} operacaoId={uid(6)} />);
    expect(screen.getByRole("button", { name: "Voltar à Sanidade" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Carregando operação" }).getAttribute("aria-busy")).toBe("true");
    tela.rerender(<OperacaoFinanceiraDetalhe {...props} operacaoId={uid(7)} />);
    await screen.findByRole("heading", { name: "Reposição entre sítios" });
    expect(screen.queryByRole("status", { name: "Carregando operação" })).toBeNull();
    await act(async () => { liberar(operacao); });
    expect(screen.queryByRole("heading", { name: "Compra de ração" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à Sanidade" })); expect(props.onVoltar).toHaveBeenCalledOnce();
  });
  it.each(["cancelamento", "estorno"])("%s pendente da operação anterior não recarrega nem sobrescreve a nova operação", async (acao) => {
    let liberar!: (dados: unknown) => void;
    const escrever = acao === "cancelamento" ? estornarOperacao : estornarTransacao;
    escrever.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }));
    obterOperacao.mockResolvedValueOnce(operacao).mockResolvedValueOnce({ ...transferencia, id: uid(7) });
    const props = { onVoltar: vi.fn(), onAbrir: vi.fn(), onCorrigir: vi.fn() };
    const tela = render(<OperacaoFinanceiraDetalhe {...props} operacaoId={uid(6)} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByRole("button", { name: acao === "cancelamento" ? "Cancelar operação" : "Estornar pagamento #1" }));
    fireEvent.change(screen.getByLabelText(acao === "cancelamento" ? "Motivo do cancelamento" : "Motivo do estorno"), { target: { value: "Correção da operação anterior" } });
    fireEvent.click(screen.getByRole("button", { name: acao === "cancelamento" ? "Confirmar cancelamento" : "Confirmar estorno" }));
    expect(escrever).toHaveBeenCalledOnce();
    tela.rerender(<OperacaoFinanceiraDetalhe {...props} operacaoId={uid(7)} />);
    await screen.findByRole("heading", { name: "Reposição entre sítios" });
    await act(async () => { liberar({ ...operacao, status: "CANCELADA" }); });
    expect(obterOperacao).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("heading", { name: "Compra de ração" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Reposição entre sítios" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("detalha perda pelo movimento, com Produto, sítio, quantidades e validade dos lotes", async () => {
    obterOperacao.mockResolvedValue({ ...operacao, tipo: "AJUSTE_ESTOQUE", descricao: "Perda: Embalagem danificada", itens: [], transacoes: [], perdas: [{
      movimentoId: uid(3), produtoId: uid(1), produtoNome: "Vacina V3", quantidade: "2", unidade: "mL", sitio: { id: 3, nome: "Rio Novo" }, motivo: "Embalagem danificada", custoUnitario: "12", valorTotal: "24", lotes: [
        { id: uid(9), nome: "Vacina outubro", codigo: "VAC-01", validade: "2026-12-31", quantidade: "1.5" },
        { id: uid(10), nome: null, codigo: "LEGADO", validade: null, quantidade: "0.5" },
      ],
    }] });
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Perda de estoque" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vacina V3" }).getAttribute("href")).toBe(`/estoque/produtos/${uid(1)}`);
    expect(screen.getByText("2 mL perdidos")).toBeTruthy();
    expect(screen.getByText("Sítio: Rio Novo")).toBeTruthy();
    expect(screen.getByText("Motivo: Embalagem danificada")).toBeTruthy();
    expect(screen.getByText(/Vacina outubro · 1,5 mL · Validade 31\/12\/2026/)).toBeTruthy();
    expect(screen.getByText(/LEGADO · 0,5 mL · Validade não informada/)).toBeTruthy();
    expect(screen.queryByText(/Não classificada/)).toBeNull();
    expect(screen.getByText(/Não gera nova despesa financeira/)).toBeTruthy();
  });
  it("preserva contexto físico após cancelamento e mostra motivo antigo não informado, sem inventar custo", async () => {
    obterOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA", tipo: "AJUSTE_ESTOQUE", descricao: "Perda antiga", valorTotal: null, itens: [], transacoes: [], perdas: [{
      movimentoId: uid(3), produtoId: uid(1), produtoNome: "Vacina antiga", quantidade: "2", unidade: "mL", sitio: null, motivo: null, custoUnitario: null, valorTotal: null, lotes: [],
    }] });
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar />);
    expect(await screen.findByText("Motivo: Motivo não registrado")).toBeTruthy();
    expect(screen.getByText("2 mL perdidos")).toBeTruthy();
    expect(screen.getByText("Sítio: Sítio não registrado")).toBeTruthy();
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
    expect(screen.getByRole("link", { name: "Estoque" }).getAttribute("href")).toBe("/estoque");
  });
  it("mantém a correção comum nas operações canceladas sem perda", async () => {
    obterOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA", perdas: [] });
    const onCorrigir = vi.fn();
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={onCorrigir} podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar correção" }));
    expect(onCorrigir).toHaveBeenCalledWith(expect.objectContaining({ id: uid(6), status: "CANCELADA" }));
    expect(screen.queryByText(/Para lançar uma nova perda/)).toBeNull();
  });
  it("abre uma página própria e revisa os efeitos antes de cancelar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    estornarOperacao.mockResolvedValue({ ...operacao, status: "CANCELADA" });
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar />);
    expect(await screen.findByRole("heading", { name: "Compra de ração" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));
    expect(screen.getByText(/Reverter 1 movimento de estoque/)).toBeTruthy();
    expect(screen.getByText(/Estornar 1 transação financeira/)).toBeTruthy();
    const confirmar = screen.getByRole("button", { name: "Confirmar cancelamento" });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Nota fiscal incorreta" } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(estornarOperacao).toHaveBeenCalledWith(uid(6), "Nota fiscal incorreta"));
  });

  it("não oferece ações destrutivas sem a permissão de lançar", async () => {
    obterOperacao.mockResolvedValue(operacao);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar={false} />);
    expect(await screen.findByRole("heading", { name: "Compra de ração" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar operação" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Estornar pagamento/ })).toBeNull();
  });

  it("não anuncia reversão física para movimentos já estornados", async () => {
    obterOperacao.mockResolvedValue({ ...operacao, movimentosEstoque: [
      { ...operacao.movimentosEstoque[0], status: "REVERTIDO", revertidoPor: { id: uid(2) } },
      { ...operacao.movimentosEstoque[0], id: uid(2), seq: 2, tipo: "SAIDA", reversaoDeId: uid(1) },
    ] });
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar operação" }));
    expect(screen.queryByText(/Reverter .* movimento.* de estoque/)).toBeNull();
  });
});

describe("OperacaoFinanceiraDetalhe — detalhe da parcela", () => {
  it("mostra valor/pago/restante e o link da conta abre o movimento correspondente no extrato", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);

    const semNbsp = (texto: string | null | undefined) => texto?.replaceAll(" ", " ");
    const dialog = within(screen.getByRole("dialog", { name: "Detalhe da parcela" }));
    expect(semNbsp(dialog.getByText("Valor da parcela").nextElementSibling?.textContent)).toBe("R$ 100,00");
    expect(semNbsp(dialog.getByText("Pago").nextElementSibling?.textContent)).toBe("R$ 80,00");
    expect(semNbsp(dialog.getByText("Restante").nextElementSibling?.textContent)).toBe("R$ 20,00");

    fireEvent.click(dialog.getByRole("button", { name: "Ver movimentação" }));
    expect(window.location.pathname + window.location.hash).toBe(`/financeiro/contas/${uid(1)}#movimento-${uid(9)}`);
  });

  it("parcela pendente informa que ainda não há pagamento ou recebimento registrado", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(2\/2\) Compra de ração/).closest("button")!);
    const dialog = within(screen.getByRole("dialog", { name: "Detalhe da parcela" }));
    expect(dialog.getByText(/ainda não tem pagamento ou recebimento registrado/)).toBeTruthy();
    expect(dialog.queryByRole("button", { name: /Estornar/ })).toBeNull();
  });

  it("estorna a liquidação com motivo e fecha o detalhe após recarregar", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    estornarTransacao.mockResolvedValue({});
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Detalhe da parcela" })).getByRole("button", { name: "Estornar pagamento" }));

    const estorno = within(screen.getByRole("dialog", { name: "Estornar liquidação" }));
    const confirmar = estorno.getByRole("button", { name: "Confirmar estorno" });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(estorno.getByLabelText("Motivo do estorno"), { target: { value: "Pagamento em duplicidade" } });
    fireEvent.click(confirmar);

    await waitFor(() => expect(estornarTransacao).toHaveBeenCalledWith(uid(9), "Pagamento em duplicidade"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Detalhe da parcela" })).toBeNull());
    expect(obterOperacao).toHaveBeenCalledTimes(2); // recarrega a operação após o estorno
  });

  it("sem permissão de lançar, não oferece a ação de estornar", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} podeLancar={false} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByText(/\(1\/2\) Compra de ração/).closest("button")!);
    expect(within(screen.getByRole("dialog", { name: "Detalhe da parcela" })).queryByRole("button", { name: /Estornar/ })).toBeNull();
  });
});

describe("OperacaoFinanceiraDetalhe — revisão do cancelamento", () => {
  it("lista os movimentos de estoque com produto/quantidade/unidade reais e o impacto líquido por conta", async () => {
    obterOperacao.mockResolvedValue(operacaoComResumo);
    render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByRole("heading", { name: "Compra de ração" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }));

    const dialog = within(screen.getByRole("dialog", { name: "Cancelar operação" }));
    expect(dialog.getByText(/Reverter entrada de 30 kg de Ração/)).toBeTruthy();
    expect(dialog.getByText(/Banco principal: impacto no saldo \+R\$\s?80,00/)).toBeTruthy();
  });
});

it("mostra erro recuperável e permite tentar carregar a operação novamente", async () => {
  obterOperacao.mockRejectedValueOnce(new Error("Dados da operação indisponíveis")).mockResolvedValue(operacao);
  render(<OperacaoFinanceiraDetalhe operacaoId={uid(6)} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
  expect(await screen.findByText("Dados da operação indisponíveis")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("heading", { name: operacao.descricao! })).toBeTruthy();
  expect(screen.queryByText("Dados da operação indisponíveis")).toBeNull();
});

it("consolida a transação no histórico e preserva o link da movimentação", async () => {
  obterOperacao.mockResolvedValue({ ...operacao, transacoes: [{ ...operacao.transacoes[0], movimentos: [{ id: uid(9), seq: 9, contaId: contaBanco.id, direcao: "SAIDA", valor: "360", conta: contaBanco }] }] });
  render(<OperacaoFinanceiraDetalhe operacaoId={operacao.id} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
  await screen.findByRole("heading", { name: "Compra de ração" });
  expect(screen.getAllByText("Pagamento #1")).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: "Banco principal" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("link", { name: "Banco principal" }));
  expect(window.location.pathname).toBe(`/financeiro/contas/${contaBanco.id}`);
  expect(window.location.hash).toBe(`#movimento-${uid(9)}`);
  expect(screen.getByRole("button", { name: "Estornar pagamento #1" })).toBeTruthy();
});
