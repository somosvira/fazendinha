// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { idPendenteDeSync } from "../lib/offline/useOfflineMutation";
import { financeiroKeys, useCriarOperacao, type Compromisso, type CriarOperacaoInput, type Operacao } from "./novo-api";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => Promise.resolve({ id: 41 })),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
  };
});

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

const filtros = { inicio: "2026-09-01", fim: "2026-09-30" };

const compraAVista: CriarOperacaoInput = {
  tipo: "COMPRA_ESTOQUE", data: new Date("2026-09-08"), descricao: "Compra de ração", parceiroId: 8,
  itens: [{ produtoId: 3, descricao: "Ração", quantidade: 10, unidade: "sc", valorUnitario: 50, estocavel: true }],
  financeiro: { condicao: "A_VISTA", contaId: 1, formaPagamento: "PIX" },
};

const servicoAPrazo: CriarOperacaoInput = {
  tipo: "SERVICO", data: new Date("2026-09-08"), descricao: "Manutenção do trator", parceiroId: 9, valorTotal: 1000,
  itens: [],
  financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 600, dataVencimento: new Date("2026-10-01") }, { valor: 400, dataVencimento: new Date("2026-11-01") }] },
};

describe("useCriarOperacao — patch otimista e invalidação", () => {
  it("compra à vista: aparece no topo da lista de Operações do filtro ativo, sem compromisso", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.operacoes(filtros), []);

    const { result } = renderHook(() => useCriarOperacao(filtros), { wrapper: wrapper(queryClient) });
    result.current.mutate(compraAVista);

    const lista = queryClient.getQueryData<Operacao[]>(financeiroKeys.operacoes(filtros))!;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", valorTotal: "500", descricao: "Compra de ração" });
    expect(idPendenteDeSync(lista[0].id)).toBe(true);
    expect(lista[0].movimentosEstoque).toHaveLength(1);
    expect(lista[0].transacoes).toHaveLength(1);
    expect(lista[0].compromissos).toHaveLength(0);
  });

  it("não escreve na lista de Operações de outro filtro (chave exata, não prefixo)", () => {
    const queryClient = new QueryClient();
    const outroFiltro = { inicio: "2026-01-01", fim: "2026-01-31" };
    queryClient.setQueryData(financeiroKeys.operacoes(filtros), []);
    queryClient.setQueryData(financeiroKeys.operacoes(outroFiltro), []);

    const { result } = renderHook(() => useCriarOperacao(filtros), { wrapper: wrapper(queryClient) });
    result.current.mutate(compraAVista);

    expect(queryClient.getQueryData<Operacao[]>(financeiroKeys.operacoes(filtros))).toHaveLength(1);
    expect(queryClient.getQueryData<Operacao[]>(financeiroKeys.operacoes(outroFiltro))).toHaveLength(0);
  });

  it("serviço a prazo: cria N compromissos com id de lote (não reconciliável) na lista de Compromissos", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.operacoes(filtros), []);
    queryClient.setQueryData(financeiroKeys.compromissos(), []);

    const { result } = renderHook(() => useCriarOperacao(filtros), { wrapper: wrapper(queryClient) });
    result.current.mutate(servicoAPrazo);

    const operacao = queryClient.getQueryData<Operacao[]>(financeiroKeys.operacoes(filtros))![0];
    expect(operacao.transacoes).toHaveLength(0); // A_PRAZO não movimenta conta agora
    expect(operacao.compromissos).toHaveLength(2);

    const compromissos = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(compromissos).toHaveLength(2);
    expect(compromissos.map((c) => c.valorOriginal)).toEqual(["600", "400"]);
    for (const c of compromissos) {
      expect(String(c.id).startsWith("lote:")).toBe(true);
      expect(idPendenteDeSync(c.id)).toBe(true);
    }
  });

  it("ajuste de estoque sem efeito financeiro: nenhum compromisso, nenhuma transação", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.operacoes(filtros), []);
    const ajuste: CriarOperacaoInput = {
      tipo: "AJUSTE_ESTOQUE", data: new Date("2026-09-08"), descricao: "Correção de contagem",
      itens: [{ produtoId: 3, descricao: "Ração", quantidade: 2, unidade: "sc", valorUnitario: 50, estocavel: true }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    };

    const { result } = renderHook(() => useCriarOperacao(filtros), { wrapper: wrapper(queryClient) });
    result.current.mutate(ajuste);

    const operacao = queryClient.getQueryData<Operacao[]>(financeiroKeys.operacoes(filtros))![0];
    expect(operacao.movimentosEstoque).toHaveLength(1);
    expect(operacao.transacoes).toHaveLength(0);
    expect(operacao.compromissos).toHaveLength(0);
  });

  it("invalida dashboard (todos os períodos), configurações e rascunho após o sync", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.operacoes(filtros), []);
    queryClient.setQueryData(financeiroKeys.dashboard("2026-09-01", "2026-09-30"), { fake: "dashboard" });
    queryClient.setQueryData(financeiroKeys.configuracoes(), { fake: "config" });
    queryClient.setQueryData(financeiroKeys.rascunho(), { fake: "rascunho" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCriarOperacao(filtros), { wrapper: wrapper(queryClient) });
    result.current.mutate(compraAVista);

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboardTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.configuracoes() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.rascunho() });
    });
  });
});
