// @vitest-environment jsdom
// Regressão: registrar um controle leiteiro alimenta dois agregados
// calculados no servidor — os heróis/indicadores de produção do painel geral
// (herois.producaoMediaVaca/producaoTotalDia, indicadores.producao) e o
// ProducaoAgg da aba Produção (totalDia/mediaVaca/ranking). Nenhum dos dois
// dá pra patchar otimisticamente (são médias/variação%/ranking calculados no
// servidor) — configRegistrarControle precisa invalidar os dois depois do
// sync, senão ficam com dado velho até o usuário sair e voltar na aba.
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { rebanhoKeys, useRegistrarControle } from "./api";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => Promise.resolve({ id: 1 })),
    inscrever: () => () => {},
    obterFila: () => filaVazia, // referência estável — nova a cada chamada quebraria useSyncExternalStore
  };
});

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useRegistrarControle — reflexo nos agregados de produção", () => {
  it("invalida rebanhoKeys.dashboardTodos() (todos os períodos) e rebanhoKeys.producaoAgg() depois do sync", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(rebanhoKeys.dashboard("hoje"), { fake: "hoje" });
    queryClient.setQueryData(rebanhoKeys.dashboard("30d"), { fake: "30d" });
    queryClient.setQueryData(rebanhoKeys.producaoAgg(), { fake: "producao" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRegistrarControle(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ animalId: "10", data: "2026-08-31", pesoTotal: 18 });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rebanhoKeys.dashboardTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rebanhoKeys.producaoAgg() });
    });

    // Prefixo casa com os dois períodos já em cache (invalidateQueries por
    // prefixo, não por chave exata) — confirma que "todos os períodos" é
    // literal, não só o que o usuário está vendo agora.
    expect(queryClient.getQueryState(rebanhoKeys.dashboard("hoje"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(rebanhoKeys.dashboard("30d"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(rebanhoKeys.producaoAgg())?.isInvalidated).toBe(true);
  });
});
