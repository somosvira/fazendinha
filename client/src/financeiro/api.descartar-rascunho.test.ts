// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { financeiroKeys, useDescartarRascunho, type RascunhoOperacao } from "./novo-api";

const { enfileirarMutation } = vi.hoisted(() => ({ enfileirarMutation: vi.fn(() => Promise.resolve(undefined)) }));
vi.mock("../lib/offline/fila", () => {
  // Referência estável (não um array literal novo por chamada) — useSyncExternalStore
  // compara por Object.is; uma snapshot nova a cada render entra em loop infinito.
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation,
    inscrever: () => () => {},
    obterFila: () => filaVazia,
  };
});

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

const rascunhoExistente: RascunhoOperacao = { id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} };

describe("useDescartarRascunho", () => {
  it("patcha o cache do rascunho pra null na hora, sem esperar o servidor", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.rascunho(), rascunhoExistente);

    const { result } = renderHook(() => useDescartarRascunho(), { wrapper: wrapper(queryClient) });
    result.current.mutate(undefined);

    expect(queryClient.getQueryData(financeiroKeys.rascunho())).toBeNull();
  });

  it("enfileira o DELETE em /financeiro/operacoes/rascunho", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.rascunho(), rascunhoExistente);

    const { result } = renderHook(() => useDescartarRascunho(), { wrapper: wrapper(queryClient) });
    result.current.mutate(undefined);

    expect(enfileirarMutation).toHaveBeenCalledWith(expect.objectContaining({
      mutationKey: "financeiro-descartar-rascunho",
      path: "/financeiro/operacoes/rascunho",
      method: "DELETE",
    }));
  });
});
