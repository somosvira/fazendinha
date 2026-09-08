// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { financeiroKeys, useTransferir, type MovimentoConta } from "./novo-api";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => Promise.resolve({ id: 1 })),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
  };
});

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useTransferir — patch otimista e invalidação", () => {
  it("prepend nos dois extratos (saída na origem, entrada no destino)", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.extrato(1), []);
    queryClient.setQueryData(financeiroKeys.extrato(2), []);

    const { result } = renderHook(() => useTransferir(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ contaOrigemId: 1, contaDestinoId: 2, valor: 500, data: "2026-09-08" });

    const origem = queryClient.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(1))!;
    const destino = queryClient.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(2))!;
    expect(origem).toHaveLength(1);
    expect(origem[0]).toMatchObject({ contaId: 1, direcao: "SAIDA", valor: "500" });
    expect(destino).toHaveLength(1);
    expect(destino[0]).toMatchObject({ contaId: 2, direcao: "ENTRADA", valor: "500" });
  });

  it("não mistura o extrato de uma conta não envolvida na transferência", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.extrato(1), []);
    queryClient.setQueryData(financeiroKeys.extrato(2), []);
    queryClient.setQueryData(financeiroKeys.extrato(3), []);

    const { result } = renderHook(() => useTransferir(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ contaOrigemId: 1, contaDestinoId: 2, valor: 500, data: "2026-09-08" });

    expect(queryClient.getQueryData<MovimentoConta[]>(financeiroKeys.extrato(3))).toHaveLength(0);
  });

  it("invalida Operações (todos os filtros), dashboard e configurações após o sync", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.extrato(1), []);
    queryClient.setQueryData(financeiroKeys.extrato(2), []);
    queryClient.setQueryData(financeiroKeys.operacoes({ inicio: "2026-09-01", fim: "2026-09-30" }), []);
    queryClient.setQueryData(financeiroKeys.dashboard("2026-09-01", "2026-09-30"), { fake: "dashboard" });
    queryClient.setQueryData(financeiroKeys.configuracoes(), { fake: "config" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransferir(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ contaOrigemId: 1, contaDestinoId: 2, valor: 500, data: "2026-09-08" });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.operacoesTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboardTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.configuracoes() });
    });
    expect(queryClient.getQueryState(financeiroKeys.operacoes({ inicio: "2026-09-01", fim: "2026-09-30" }))?.isInvalidated).toBe(true);
  });
});
