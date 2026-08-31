// @vitest-environment jsdom
// Regressão da fila offline de Estoque > movimento manual: confirma que o
// patch otimista de saldo usa o sinal certo por tipo (ENTRADA/AJUSTE somam,
// SAIDA subtrai — mesma regra de estoque.calc.ts no server) e que excluir
// reverte exatamente o delta que o create aplicou.
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { rebanhoKeys, useRegistrarMovimento, useExcluirMovimento, type SaldoDTO, type MovimentoDTO } from "./api";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})), // nunca resolve — só interessa o patch otimista
    inscrever: () => () => {},
    obterFila: () => filaVazia, // referência estável — nova a cada chamada quebraria useSyncExternalStore
  };
});

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

const SALDO_BASE: SaldoDTO = { produtoId: 1, nome: "Sal mineral", tipo: "MEDICAMENTO", unidade: "kg", setor: "GERAL", saldo: 100, valor: 500, minimoEstoque: 20, abaixoMinimo: false };

describe("useRegistrarMovimento — patch otimista de saldo", () => {
  it("ENTRADA soma ao saldo e ao valor", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.saldos(), [SALDO_BASE]);
    queryClient.setQueryData(rebanhoKeys.movimentos(), []);

    const { result } = renderHook(() => useRegistrarMovimento(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      produtoId: 1, tipo: "ENTRADA", data: "2026-08-31", quantidade: 10,
      produtoInfo: { nome: "Sal mineral", unidade: "kg", setor: "GERAL", custoUnitario: 5 },
    });

    const saldos = queryClient.getQueryData<SaldoDTO[]>(rebanhoKeys.saldos());
    expect(saldos?.[0]).toMatchObject({ saldo: 110, valor: 550 });

    const movimentos = queryClient.getQueryData<MovimentoDTO[]>(rebanhoKeys.movimentos());
    expect(movimentos).toHaveLength(1);
    expect(movimentos?.[0]).toMatchObject({ produtoId: 1, tipo: "ENTRADA", origem: "MANUAL", quantidade: 10, custoUnitario: 5, valorTotal: 50 });
  });

  it("SAIDA subtrai do saldo e do valor", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.saldos(), [SALDO_BASE]);
    queryClient.setQueryData(rebanhoKeys.movimentos(), []);

    const { result } = renderHook(() => useRegistrarMovimento(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      produtoId: 1, tipo: "SAIDA", data: "2026-08-31", quantidade: 4,
      produtoInfo: { nome: "Sal mineral", unidade: "kg", setor: "GERAL", custoUnitario: 5 },
    });

    const saldos = queryClient.getQueryData<SaldoDTO[]>(rebanhoKeys.saldos());
    expect(saldos?.[0]).toMatchObject({ saldo: 96, valor: 480 });
  });

  it("AJUSTE negativo (correção de inventário) subtrai do saldo", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.saldos(), [SALDO_BASE]);
    queryClient.setQueryData(rebanhoKeys.movimentos(), []);

    const { result } = renderHook(() => useRegistrarMovimento(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      produtoId: 1, tipo: "AJUSTE", data: "2026-08-31", quantidade: -6,
      produtoInfo: { nome: "Sal mineral", unidade: "kg", setor: "GERAL", custoUnitario: 5 },
    });

    const saldos = queryClient.getQueryData<SaldoDTO[]>(rebanhoKeys.saldos());
    expect(saldos?.[0]).toMatchObject({ saldo: 94, valor: 470 });
  });

  it("cruza abaixoMinimo quando o novo saldo fica abaixo do mínimo cadastrado", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.saldos(), [SALDO_BASE]); // minimoEstoque: 20
    queryClient.setQueryData(rebanhoKeys.movimentos(), []);

    const { result } = renderHook(() => useRegistrarMovimento(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      produtoId: 1, tipo: "SAIDA", data: "2026-08-31", quantidade: 85,
      produtoInfo: { nome: "Sal mineral", unidade: "kg", setor: "GERAL", custoUnitario: 5 },
    });

    const saldos = queryClient.getQueryData<SaldoDTO[]>(rebanhoKeys.saldos());
    expect(saldos?.[0]).toMatchObject({ saldo: 15, abaixoMinimo: true });
  });
});

describe("useExcluirMovimento — reverte exatamente o delta do movimento original", () => {
  it("excluir uma ENTRADA desfaz a soma feita no create", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.saldos(), [{ ...SALDO_BASE, saldo: 110, valor: 550 }]);
    queryClient.setQueryData(rebanhoKeys.movimentos(), [
      { id: 42, produtoId: 1, produto: "Sal mineral", setor: "GERAL", tipo: "ENTRADA", origem: "MANUAL", data: "2026-08-31", quantidade: 10, custoUnitario: 5, valorTotal: 50, fornecedor: null, grupo: null, observacao: null } satisfies MovimentoDTO,
    ]);

    const { result } = renderHook(() => useExcluirMovimento(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ movimentoId: 42, produtoId: 1, tipo: "ENTRADA", quantidade: 10, valorTotal: 50 });

    const saldos = queryClient.getQueryData<SaldoDTO[]>(rebanhoKeys.saldos());
    expect(saldos?.[0]).toMatchObject({ saldo: 100, valor: 500 });

    const movimentos = queryClient.getQueryData<MovimentoDTO[]>(rebanhoKeys.movimentos());
    expect(movimentos).toEqual([]);
  });
});
