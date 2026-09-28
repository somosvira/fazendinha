// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { enfileirarMutation } from "../lib/offline/fila";
import { uid } from "../lib/uid.fixture";
import { estoqueKeys, financeiroKeys } from "./queries";
import { useAjusteEstoque, useCriarOperacao, useDescartarRascunho, useLiquidarCompromisso, useTransferir, type CriarOperacaoInput } from "./mutations";
import { estadoRascunhoAtivo, prepararPublicacaoRascunho } from "./rascunhoAtivo";
import type { Compromisso, ConfiguracoesFinanceiras, DashboardFinanceiro, MovimentoConta, MovimentoGeral, Operacao, RascunhoOperacao } from "./novo-api";
import type { SaldoDTO } from "../estoque/api";

let resposta: () => Promise<unknown> = () => new Promise(() => {});
vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => resposta()),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
    aguardarFilaLivre: () => Promise.resolve(),
    filaTravada: () => false,
  };
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BANCO = uid(1);
const CAIXA = uid(2);
const FORNECEDOR = uid(3);
const RACAO = uid(4);
const CENTRO = uid(5);
const periodo = { inicio: "2026-09-01", fim: "2026-09-30" };

const conta = (id: string, nome: string, saldoAtual: string) => ({
  id, nome, tipo: "BANCO" as const, instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-01-01",
  saldoAtual, incluirNoSaldoGeral: true, ativo: true, temMovimentos: true,
});
const config = (): ConfiguracoesFinanceiras => ({
  contas: [conta(BANCO, "Banco", "5000.00"), conta(CAIXA, "Caixa", "100.00")],
  parceiros: [{ id: FORNECEDOR, nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true, referencias: 0 }],
  categorias: [],
  centrosCusto: [{ id: CENTRO, nome: "Pecuária", ativo: true, ordem: 1 }],
  produtos: [{ id: RACAO, nome: "Ração", unidade: "KG", ativo: true, centroCustoIds: [CENTRO] }],
});
const dashboard = (): DashboardFinanceiro => ({
  periodo, saldoGeral: "5100.00", contas: config().contas, realizado: { entradas: "0", saidas: "0", resultado: "0" }, fluxo: [],
  compromissos: { aPagar: "0", aReceber: "0" }, proximosCompromissos: [], despesasPorCategoria: [],
  base: {} as DashboardFinanceiro["base"],
});
const saldoRacao = (saldo: number): SaldoDTO => ({ produtoId: RACAO, nome: "Ração", categoria: null, unidade: "KG", centrosCusto: [], saldo, custoMedio: 2, valor: saldo * 2, minimoEstoque: null, abaixoMinimo: false });

function montar(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}
function clienteComCache() {
  const qc = new QueryClient();
  qc.setQueryData(financeiroKeys.configuracoes(), config());
  qc.setQueryData(financeiroKeys.dashboard(periodo.inicio, periodo.fim), dashboard());
  qc.setQueryData(financeiroKeys.operacoes(periodo), []);
  qc.setQueryData(financeiroKeys.compromissos(periodo), []);
  qc.setQueryData(financeiroKeys.extrato(BANCO), []);
  qc.setQueryData(financeiroKeys.extrato(CAIXA), []);
  qc.setQueryData(financeiroKeys.extratoGeral(), []);
  qc.setQueryData(estoqueKeys.saldos(), [saldoRacao(10)]);
  return qc;
}
const corpoEnviado = () => vi.mocked(enfileirarMutation).mock.calls.at(-1)![0];

const compraAVista: CriarOperacaoInput = {
  tipo: "COMPRA_ESTOQUE", data: "2026-09-08", descricao: "Compra de ração", parceiroId: FORNECEDOR,
  itens: [{ produtoId: RACAO, descricao: "Ração", quantidade: "10", unidade: "kg", valorUnitario: "5", estocavel: true }],
  financeiro: { condicao: "A_VISTA", contaId: BANCO, formaPagamento: "PIX" },
};
const compraAPrazo: CriarOperacaoInput = {
  ...compraAVista,
  financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: "30", dataVencimento: "2026-09-20" }, { valor: "20", dataVencimento: "2026-10-20" }] },
};

beforeEach(() => {
  vi.mocked(enfileirarMutation).mockClear();
  resposta = () => new Promise(() => {});
});

describe("useCriarOperacao", () => {
  it("envia o id da operação e das parcelas gerados no cliente", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    const id = result.current.mutate(compraAPrazo);

    const pedido = corpoEnviado();
    expect(pedido).toMatchObject({ path: "/financeiro/operacoes", method: "POST" });
    const corpo = pedido.body as CriarOperacaoInput;
    expect(corpo.id).toBe(id);
    expect(id).toMatch(UUID);
    expect(corpo.financeiro.parcelas!.map((parcela) => parcela.id)).toEqual([expect.stringMatching(UUID), expect.stringMatching(UUID)]);
  });

  it("recusa antes de enfileirar quando o schema não aceita, apontando o campo", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    expect(() => result.current.mutate({ ...compraAVista, parceiroId: undefined })).toThrow(expect.objectContaining({ status: 422, campo: "parceiroId" }));
    expect(() => result.current.mutate({ ...compraAVista, financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: "10", dataVencimento: "2026-10-01" }] } }))
      .toThrow(/soma das parcelas/);
    expect(enfileirarMutation).not.toHaveBeenCalled();
    expect(qc.getQueryData<Operacao[]>(financeiroKeys.operacoes(periodo))).toEqual([]);
  });

  it("compra à vista aparece na lista, no detalhe, no extrato e tira o valor do saldo da conta e do saldo geral", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    const id = result.current.mutate(compraAVista);

    const [operacao] = qc.getQueryData<Operacao[]>(financeiroKeys.operacoes(periodo))!;
    expect(operacao).toMatchObject({ id, numero: null, status: "CONFIRMADA", valorTotal: "50.00", parceiro: { nome: "Fornecedor Rural" } });
    expect(operacao.transacoes[0].movimentos[0]).toMatchObject({ contaId: BANCO, direcao: "SAIDA", valor: "50.00" });
    expect(operacao.movimentosEstoque).toHaveLength(1);
    expect(qc.getQueryData(financeiroKeys.operacao(id))).toEqual(operacao);
    expect(qc.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(BANCO))![0]).toMatchObject({ direcao: "SAIDA", valor: "50.00", transacao: { operacao: { id, numero: null } } });
    expect(qc.getQueryData<MovimentoGeral[]>(financeiroKeys.extratoGeral())).toHaveLength(1);
    expect(qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas[0].saldoAtual).toBe("4950.00");
    expect(qc.getQueryData<DashboardFinanceiro>(financeiroKeys.dashboard(periodo.inicio, periodo.fim))!.saldoGeral).toBe("5050.00");
    expect(qc.getQueryData<SaldoDTO[]>(estoqueKeys.saldos())![0].saldo).toBe(20);
  });

  it("compra a prazo cria os compromissos com os mesmos ids das parcelas, só no período de vencimento", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    result.current.mutate(compraAPrazo);

    const parcelas = (corpoEnviado().body as CriarOperacaoInput).financeiro.parcelas!;
    const compromissos = qc.getQueryData<Compromisso[]>(financeiroKeys.compromissos(periodo))!;
    expect(compromissos).toHaveLength(1);
    expect(compromissos[0]).toMatchObject({ id: parcelas[0].id, status: "PENDENTE", valorOriginal: "30.00", saldoPendente: "30.00", operacao: { numero: null } });
    expect(qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas[0].saldoAtual).toBe("5000.00");
    expect(qc.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(BANCO))).toEqual([]);
  });

  it("lista de todo o período (início e fim vazios) recebe todos os compromissos", () => {
    const qc = clienteComCache();
    const todoPeriodo = { inicio: "", fim: "" };
    qc.setQueryData(financeiroKeys.compromissos(todoPeriodo), []);
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    result.current.mutate(compraAPrazo);
    expect(qc.getQueryData<Compromisso[]>(financeiroKeys.compromissos(todoPeriodo))).toHaveLength(2);
  });

  it("não escreve em lista de período que não contém a data", () => {
    const qc = clienteComCache();
    const janeiro = { inicio: "2026-01-01", fim: "2026-01-31" };
    qc.setQueryData(financeiroKeys.operacoes(janeiro), []);
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    result.current.mutate(compraAVista);
    expect(qc.getQueryData(financeiroKeys.operacoes(janeiro))).toEqual([]);
  });

  it("desfaz o otimista quando o servidor recusa", async () => {
    let rejeitar!: (erro: unknown) => void;
    resposta = () => new Promise((_, reject) => { rejeitar = reject; });
    const qc = clienteComCache();
    const onError = vi.fn();
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    const id = result.current.mutate(compraAVista, { onError });
    await vi.waitFor(() => expect(rejeitar).toBeTypeOf("function"));
    rejeitar(new Error("Período fechado"));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(qc.getQueryData(financeiroKeys.operacoes(periodo))).toEqual([]);
    expect(qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas[0].saldoAtual).toBe("5000.00");
    expect(qc.getQueryData(financeiroKeys.operacao(id))).toBeUndefined();
  });

  it("invalida listas, dashboard e configurações depois de sincronizar", async () => {
    resposta = () => Promise.resolve({ id: "x" });
    const qc = clienteComCache();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    result.current.mutate(compraAPrazo);
    await vi.waitFor(() => {
      expect(invalidar).toHaveBeenCalledWith({ queryKey: financeiroKeys.operacoesTodos() });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: financeiroKeys.compromissosTodos() });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboardTodos() });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: financeiroKeys.configuracoes() });
    });
  });
});

describe("useLiquidarCompromisso", () => {
  it("liquida um compromisso criado offline pelo id da parcela, antes de sincronizar", () => {
    const qc = clienteComCache();
    const criar = renderHook(() => useCriarOperacao(), { wrapper: montar(qc) });
    criar.result.current.mutate(compraAPrazo);
    const idParcela = (corpoEnviado().body as CriarOperacaoInput).financeiro.parcelas![0].id!;

    const liquidar = renderHook(() => useLiquidarCompromisso(), { wrapper: montar(qc) });
    const transacaoId = liquidar.result.current.mutate({ compromissoId: idParcela, tipo: "PAGAR", contaId: CAIXA, valor: 10, data: "2026-09-10" });

    const pedido = corpoEnviado();
    expect(pedido.path).toBe(`/financeiro/compromissos/${idParcela}/liquidacoes`);
    expect(pedido.body).toMatchObject({ transacaoId, contaId: CAIXA, valor: 10 });
    expect(transacaoId).toMatch(UUID);
    expect(qc.getQueryData<Compromisso[]>(financeiroKeys.compromissos(periodo))![0]).toMatchObject({ id: idParcela, valorLiquidado: "10.00", saldoPendente: "20.00", status: "PARCIAL" });
    expect(qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas[1].saldoAtual).toBe("90.00");
    expect(qc.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(CAIXA))![0]).toMatchObject({ direcao: "SAIDA", transacao: { id: transacaoId, tipo: "PAGAMENTO" } });
  });

  it("recebimento que zera o saldo marca LIQUIDADO e soma na conta", () => {
    const qc = clienteComCache();
    const compromisso = { id: uid(9), seq: 3, tipo: "RECEBER", status: "PENDENTE", valorOriginal: "200.00", valorLiquidado: "0.00", saldoPendente: "200.00", dataVencimento: "2026-09-15T00:00:00.000Z", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null, operacao: { id: uid(10), numero: 7, tipo: "VENDA", descricao: "Venda" } } satisfies Compromisso;
    qc.setQueryData(financeiroKeys.compromissos(periodo), [compromisso]);
    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: montar(qc) });
    result.current.mutate({ compromissoId: compromisso.id, tipo: "RECEBER", contaId: BANCO, valor: 200, data: "2026-09-10" });

    expect(qc.getQueryData<Compromisso[]>(financeiroKeys.compromissos(periodo))![0]).toMatchObject({ status: "LIQUIDADO", saldoPendente: "0.00" });
    expect(qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas[0].saldoAtual).toBe("5200.00");
  });

  it("liquida compromisso já existente com a listagem de operações em cache (compromissos sem valores liquidados)", () => {
    const qc = clienteComCache();
    const compromisso = { id: uid(9), seq: 3, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "200.00", valorLiquidado: "0.00", saldoPendente: "200.00", dataVencimento: "2026-09-15T00:00:00.000Z", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null, operacao: { id: uid(10), numero: 7, tipo: "COMPRA_ESTOQUE", descricao: "Compra" } } satisfies Compromisso;
    qc.setQueryData(financeiroKeys.compromissos(periodo), [compromisso]);
    const daListagem = { id: compromisso.id, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "200.00" };
    qc.setQueryData(financeiroKeys.operacoes(periodo), [{ id: uid(10), compromissos: [daListagem] }]);
    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: montar(qc) });
    result.current.mutate({ compromissoId: compromisso.id, tipo: "PAGAR", contaId: BANCO, valor: 50, data: "2026-09-10" });

    expect(enfileirarMutation).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData<Compromisso[]>(financeiroKeys.compromissos(periodo))![0]).toMatchObject({ status: "PARCIAL", saldoPendente: "150.00" });
    expect(qc.getQueryData<{ compromissos: unknown[] }[]>(financeiroKeys.operacoes(periodo))![0].compromissos[0]).toEqual(daListagem);
  });

  it("não enfileira valor inválido", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: montar(qc) });
    expect(() => result.current.mutate({ compromissoId: uid(9), tipo: "PAGAR", contaId: BANCO, valor: 0, data: "2026-09-10" })).toThrow(expect.objectContaining({ campo: "valor" }));
    expect(enfileirarMutation).not.toHaveBeenCalled();
  });
});

describe("useTransferir", () => {
  it("envia o id, cria a operação e move o saldo das duas contas", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useTransferir(), { wrapper: montar(qc) });
    const id = result.current.mutate({ contaOrigemId: BANCO, contaDestinoId: CAIXA, valor: 300, data: "2026-09-10" });

    expect(corpoEnviado()).toMatchObject({ path: "/financeiro/transferencias", body: { id, contaOrigemId: BANCO, contaDestinoId: CAIXA, valor: 300 } });
    expect(qc.getQueryData<Operacao[]>(financeiroKeys.operacoes(periodo))![0]).toMatchObject({ id, tipo: "TRANSFERENCIA_FINANCEIRA", numero: null });
    const contas = qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!.contas;
    expect(contas.map((item) => item.saldoAtual)).toEqual(["4700.00", "400.00"]);
    expect(qc.getQueryData<DashboardFinanceiro>(financeiroKeys.dashboard(periodo.inicio, periodo.fim))!.saldoGeral).toBe("5100.00");
    expect(qc.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(BANCO))![0].direcao).toBe("SAIDA");
    expect(qc.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(CAIXA))![0].direcao).toBe("ENTRADA");
    expect(qc.getQueryData<MovimentoGeral[]>(financeiroKeys.extratoGeral())).toHaveLength(2);
  });

  it("recusa origem igual ao destino sem enfileirar", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useTransferir(), { wrapper: montar(qc) });
    expect(() => result.current.mutate({ contaOrigemId: BANCO, contaDestinoId: BANCO, valor: 1, data: "2026-09-10" })).toThrow();
    expect(enfileirarMutation).not.toHaveBeenCalled();
  });
});

describe("useAjusteEstoque", () => {
  it("envia o id e o saldo esperado, e o saldo em cache passa a ser o contado", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useAjusteEstoque(), { wrapper: montar(qc) });
    const id = result.current.mutate({ produtoId: RACAO, quantidadeContada: 7, saldoEsperado: 10, observacao: "Contagem de setembro" });

    expect(corpoEnviado()).toMatchObject({ path: "/estoque/ajustes", body: { id, produtoId: RACAO, quantidadeContada: 7, saldoEsperado: 10 } });
    expect(qc.getQueryData<SaldoDTO[]>(estoqueKeys.saldos())![0]).toMatchObject({ saldo: 7, valor: 14 });
    expect(qc.getQueryData<Operacao>(financeiroKeys.operacao(id))).toMatchObject({ tipo: "AJUSTE_ESTOQUE", numero: null, movimentosEstoque: [{ quantidade: "-3" }] });
  });

  it("justificativa curta não vai para a fila", () => {
    const qc = clienteComCache();
    const { result } = renderHook(() => useAjusteEstoque(), { wrapper: montar(qc) });
    expect(() => result.current.mutate({ produtoId: RACAO, quantidadeContada: 7, saldoEsperado: 10, observacao: "x" })).toThrow(/justificativa/);
    expect(enfileirarMutation).not.toHaveBeenCalled();
  });
});

describe("useDescartarRascunho", () => {
  it("enfileira o DELETE e esquece o rascunho na hora", () => {
    const qc = clienteComCache();
    const rascunho = { id: uid(8), versao: 2, updatedAt: "2026-09-10", documentos: [], dados: {} } satisfies RascunhoOperacao;
    prepararPublicacaoRascunho("escrita")(rascunho);
    const { result } = renderHook(() => useDescartarRascunho(), { wrapper: montar(qc) });
    result.current.mutate();

    expect(corpoEnviado()).toMatchObject({ path: "/financeiro/operacoes/rascunho", method: "DELETE" });
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
  });
});
