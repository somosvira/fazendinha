// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { financeiroKeys, useLiquidarCompromisso, type Compromisso } from "./novo-api";

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

const compromissoBase: Compromisso = {
  id: 10, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "1000", valorLiquidado: "0", saldoPendente: "1000",
  dataVencimento: "2026-10-01", vencido: false, parceiro: null, operacao: { id: 41, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" },
};

describe("useLiquidarCompromisso — patch otimista e invalidação", () => {
  it("liquidação parcial: soma no valorLiquidado, reduz saldoPendente e marca PARCIAL", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, contaId: 3, valor: 400, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[0]).toMatchObject({ valorLiquidado: "400", saldoPendente: "600", status: "PARCIAL" });
  });

  it("liquidação que zera o saldo marca LIQUIDADO", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, contaId: 3, valor: 1000, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[0]).toMatchObject({ valorLiquidado: "1000", saldoPendente: "0", status: "LIQUIDADO" });
  });

  it("não mexe em outro compromisso da mesma lista", async () => {
    const outro: Compromisso = { ...compromissoBase, id: 11, valorOriginal: "500", saldoPendente: "500" };
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase, outro]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, contaId: 3, valor: 200, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[1]).toEqual(outro);
  });

  it("invalida extrato da conta, dashboard (todos os períodos) e configurações após o sync", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);
    queryClient.setQueryData(financeiroKeys.extrato(3), []);
    queryClient.setQueryData(financeiroKeys.dashboard("2026-09-01", "2026-09-30"), { fake: "dashboard" });
    queryClient.setQueryData(financeiroKeys.configuracoes(), { fake: "config" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, contaId: 3, valor: 400, data: "2026-09-08" });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.extrato(3) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboardTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.configuracoes() });
    });
    expect(queryClient.getQueryState(financeiroKeys.dashboard("2026-09-01", "2026-09-30"))?.isInvalidated).toBe(true);
  });
});
