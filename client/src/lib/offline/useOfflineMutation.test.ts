// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { useOfflineMutation, type UseOfflineMutationConfig } from "./useOfflineMutation";

vi.mock("./fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})),
    inscrever: () => () => {},
    obterFila: () => filaVazia, // referência estável — nova a cada chamada quebraria useSyncExternalStore
  };
});

interface Item {
  id: string;
  nome: string;
  endereco: { rua: string; cidade: string };
}

describe("useOfflineMutation — patch otimista", () => {
  it("merge profundo preserva campo irmão de objeto aninhado (update parcial)", () => {
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, [
      { id: "1", nome: "Fazenda X", endereco: { rua: "Rua A", cidade: "Uberaba" } },
    ]);

    const cfg: UseOfflineMutationConfig<{ id: string; endereco: { rua: string } }, Item> = {
      mutationKey: "teste.update",
      path: () => "/itens/1",
      method: "PATCH",
      op: "update",
      match: (item, input) => item.id === input.id,
      queryKeys: () => [queryKey],
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper });

    result.current.mutate({ id: "1", endereco: { rua: "Rua B" } });

    const atualizado = queryClient.getQueryData<Item[]>(queryKey);
    expect(atualizado?.[0].endereco).toEqual({ rua: "Rua B", cidade: "Uberaba" });
    expect(atualizado?.[0].nome).toBe("Fazenda X");
  });
});
