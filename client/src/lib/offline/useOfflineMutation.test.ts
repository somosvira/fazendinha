// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import {
  useOfflineMutation,
  appendItemToCacheList,
  insertItemSortedInCacheList,
  invalidar,
  porPrefixo,
  removeItemFromCacheList,
  updateItemInCacheList,
  upsertItemInCacheList,
  validado,
  type UseOfflineMutationConfig,
} from "./useOfflineMutation";

let enfileirarImpl: () => Promise<unknown> = () => new Promise(() => {});

vi.mock("./fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => enfileirarImpl()),
    inscrever: () => () => {},
    obterFila: () => filaVazia, // referência estável — nova a cada chamada quebraria useSyncExternalStore
  };
});

interface Item {
  id: string;
  nome: string;
  endereco: { rua: string; cidade: string };
}

function montarWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useOfflineMutation — patch otimista via aplicar", () => {
  it("merge profundo (updateItemInCacheList) preserva campo irmão de objeto aninhado", () => {
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, [
      { id: "1", nome: "Fazenda X", endereco: { rua: "Rua A", cidade: "Uberaba" } },
    ]);

    const cfg: UseOfflineMutationConfig<{ id: string; endereco: { rua: string } }, Item> = {
      mutationKey: "teste.update",
      path: () => "/itens/1",
      method: "PATCH",
      queryKeys: (input) => [
        {
          queryKey,
          aplicar: (atual: Item[] | undefined) =>
            updateItemInCacheList(atual, input as unknown as Partial<Item>, (item) => item.id === input.id),
        },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    result.current.mutate({ id: "1", endereco: { rua: "Rua B" } });

    const atualizado = queryClient.getQueryData<Item[]>(queryKey);
    expect(atualizado?.[0].endereco).toEqual({ rua: "Rua B", cidade: "Uberaba" });
    expect(atualizado?.[0].nome).toBe("Fazenda X");
  });

  it("criarOtimista + appendItemToCacheList insere o item novo na lista", () => {
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, []);

    const cfg: UseOfflineMutationConfig<{ nome: string }, Item> = {
      mutationKey: "teste.create",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: "temp-1", nome: input.nome, endereco: { rua: "", cidade: "" } }),
      queryKeys: (_input, itemOtimista) => [
        { queryKey, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    result.current.mutate({ nome: "Fazenda Y" });

    const atual = queryClient.getQueryData<Item[]>(queryKey);
    expect(atual).toHaveLength(1);
    expect(atual?.[0]).toMatchObject({ id: "temp-1", nome: "Fazenda Y" });
  });

  it("removeItemFromCacheList tira o item que corresponde", () => {
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, [
      { id: "1", nome: "A", endereco: { rua: "", cidade: "" } },
      { id: "2", nome: "B", endereco: { rua: "", cidade: "" } },
    ]);

    const cfg: UseOfflineMutationConfig<{ id: string }, Item> = {
      mutationKey: "teste.delete",
      path: (input) => `/itens/${input.id}`,
      method: "DELETE",
      queryKeys: (input) => [
        { queryKey, aplicar: (atual: Item[] | undefined) => removeItemFromCacheList(atual, (item) => item.id === input.id) },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    result.current.mutate({ id: "1" });

    const atual = queryClient.getQueryData<Item[]>(queryKey);
    expect(atual?.map((i) => i.id)).toEqual(["2"]);
  });

  it("upsertItemInCacheList atualiza quando já existe e acrescenta quando não existe", () => {
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, [{ id: "1", nome: "A", endereco: { rua: "R1", cidade: "C1" } }]);

    const cfg: UseOfflineMutationConfig<{ id: string; nome: string }, Item> = {
      mutationKey: "teste.upsert",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: input.id, nome: input.nome, endereco: { rua: "", cidade: "" } }),
      queryKeys: (input, itemOtimista) => [
        {
          queryKey,
          aplicar: (atual: Item[] | undefined) =>
            upsertItemInCacheList(atual, itemOtimista!, input as unknown as Partial<Item>, (item) => item.id === input.id),
        },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });

    // já existe id "1" — vira update, sem duplicar e sem perder `endereco`.
    result.current.mutate({ id: "1", nome: "A editado" });
    let atual = queryClient.getQueryData<Item[]>(queryKey);
    expect(atual).toHaveLength(1);
    expect(atual?.[0]).toMatchObject({ id: "1", nome: "A editado", endereco: { rua: "R1", cidade: "C1" } });

    // id novo — vira append.
    result.current.mutate({ id: "2", nome: "B" });
    atual = queryClient.getQueryData<Item[]>(queryKey);
    expect(atual).toHaveLength(2);
    expect(atual?.[1]).toMatchObject({ id: "2", nome: "B" });
  });

  it("entrada sem `aplicar` não muda o cache na escrita (só invalida depois do sync)", async () => {
    enfileirarImpl = () => Promise.resolve({ id: "1" });
    const queryClient = new QueryClient();
    const listaKey: QueryKey = ["itens"];
    const resumoKey: QueryKey = ["resumo"];
    queryClient.setQueryData(listaKey, []);
    queryClient.setQueryData(resumoKey, { total: 0 });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const cfg: UseOfflineMutationConfig<{ nome: string }, Item> = {
      mutationKey: "teste.invalidate-only",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: "temp-1", nome: input.nome, endereco: { rua: "", cidade: "" } }),
      queryKeys: (_input, itemOtimista) => [
        { queryKey: listaKey, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
        { queryKey: resumoKey }, // sem aplicar — dado derivado, recomputado no servidor
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    result.current.mutate({ nome: "X" });

    // resumo não muda na hora — não tem `aplicar`.
    expect(queryClient.getQueryData(resumoKey)).toEqual({ total: 0 });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resumoKey });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listaKey });
    });
  });

  it("em erro, invalida as entradas e o refetch traz o estado do servidor", async () => {
    enfileirarImpl = () => Promise.reject(new Error("falhou"));
    const queryClient = new QueryClient();
    const listaKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(listaKey, []);

    const cfg: UseOfflineMutationConfig<{ nome: string }, Item> = {
      mutationKey: "teste.rollback",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: "temp-1", nome: input.nome, endereco: { rua: "", cidade: "" } }),
      queryKeys: (_input, itemOtimista) => [
        { queryKey: listaKey, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    const onError = vi.fn();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    result.current.mutate({ nome: "X" }, { onError });

    expect(queryClient.getQueryData<Item[]>(listaKey)).toHaveLength(1);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listaKey });
  });

  it("duas mutações otimistas na mesma query recusadas em sequência não deixam fantasma nem escondem a pendente", async () => {
    const queryClient = new QueryClient();
    const listaKey: QueryKey = ["itens"];
    let servidor: Item[] = [];
    const observador = new QueryObserver(queryClient, { queryKey: listaKey, queryFn: async () => servidor, staleTime: Infinity });
    const cancelar = observador.subscribe(() => {});
    await vi.waitFor(() => expect(queryClient.getQueryData(listaKey)).toEqual([]));

    const rejeicoes: ((err: Error) => void)[] = [];
    enfileirarImpl = () => new Promise((_, rejeitar) => rejeicoes.push(rejeitar));
    const cfg: UseOfflineMutationConfig<{ id: string }, Item> = {
      mutationKey: "teste.duas-recusadas",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: input.id, nome: input.id, endereco: { rua: "", cidade: "" } }),
      queryKeys: (_input, itemOtimista) => [
        { queryKey: listaKey, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
      ],
    };
    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    const onErrorA = vi.fn();
    const onErrorB = vi.fn();
    result.current.mutate({ id: "a" }, { onError: onErrorA });
    result.current.mutate({ id: "b" }, { onError: onErrorB });
    const ids = () => (queryClient.getQueryData<Item[]>(listaKey) ?? []).map((i) => i.id);
    expect(ids()).toEqual(["a", "b"]);

    // "a" é recusada enquanto "b" já consta no servidor, ainda sem confirmação.
    servidor = [{ id: "b", nome: "b", endereco: { rua: "", cidade: "" } }];
    rejeicoes[0](new Error("recusada"));
    await vi.waitFor(() => expect(onErrorA).toHaveBeenCalled());
    await vi.waitFor(() => expect(ids()).toEqual(["b"]));

    servidor = [];
    rejeicoes[1](new Error("recusada"));
    await vi.waitFor(() => expect(onErrorB).toHaveBeenCalled());
    await vi.waitFor(() => expect(ids()).toEqual([]));
    cancelar();
  });

  it("aplicar que lança numa entrada não deixa patch de entrada anterior no cache nem enfileira", async () => {
    const { enfileirarMutation } = await import("./fila");
    vi.mocked(enfileirarMutation).mockClear();
    const queryClient = new QueryClient();
    const chaveA: QueryKey = ["a"];
    const chaveB: QueryKey = ["b"];
    queryClient.setQueryData<Item[]>(chaveA, []);
    queryClient.setQueryData<Item[]>(chaveB, []);

    const cfg: UseOfflineMutationConfig<{ nome: string }, Item> = {
      mutationKey: "teste.falha-aplicar",
      path: () => "/itens",
      method: "POST",
      criarOtimista: (input) => ({ id: "temp-1", nome: input.nome, endereco: { rua: "", cidade: "" } }),
      queryKeys: (_input, itemOtimista) => [
        { queryKey: chaveA, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
        {
          queryKey: chaveB,
          aplicar: () => {
            throw new Error("aplicar quebrou");
          },
        },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    const onError = vi.fn();
    result.current.mutate({ nome: "X" }, { onError });

    expect(queryClient.getQueryData<Item[]>(chaveA)).toEqual([]);
    expect(queryClient.getQueryData<Item[]>(chaveB)).toEqual([]);
    expect(enfileirarMutation).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("criarOtimista que lança não muda cache nem enfileira", async () => {
    const { enfileirarMutation } = await import("./fila");
    vi.mocked(enfileirarMutation).mockClear();
    const queryClient = new QueryClient();
    const queryKey: QueryKey = ["itens"];
    queryClient.setQueryData<Item[]>(queryKey, []);

    const cfg: UseOfflineMutationConfig<{ nome: string }, Item> = {
      mutationKey: "teste.falha-criar-otimista",
      path: () => "/itens",
      method: "POST",
      criarOtimista: () => {
        throw new Error("criarOtimista quebrou");
      },
      queryKeys: (_input, itemOtimista) => [
        { queryKey, aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!) },
      ],
    };

    const { result } = renderHook(() => useOfflineMutation(cfg), { wrapper: montarWrapper(queryClient) });
    const onError = vi.fn();
    result.current.mutate({ nome: "X" }, { onError });

    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
    expect(enfileirarMutation).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});

describe("insertItemSortedInCacheList", () => {
  const chave = (v: { data: string }) => v.data;

  it("desc: item novo fica à frente dos de mesma chave", () => {
    const lista = [{ data: "2026-01-02" }, { data: "2026-01-01" }];
    const resultado = insertItemSortedInCacheList(lista, { data: "2026-01-01" }, chave, "desc");
    expect(resultado.map((v) => v.data)).toEqual(["2026-01-02", "2026-01-01", "2026-01-01"]);
  });

  it("asc: item novo fica depois dos de mesma chave", () => {
    const lista = [{ data: "2026-01-01" }, { data: "2026-01-02" }];
    const resultado = insertItemSortedInCacheList(lista, { data: "2026-01-01" }, chave, "asc");
    expect(resultado.map((v) => v.data)).toEqual(["2026-01-01", "2026-01-01", "2026-01-02"]);
  });

  it("lista undefined vira lista de um item", () => {
    expect(insertItemSortedInCacheList(undefined, { data: "2026-01-01" }, chave, "desc")).toEqual([{ data: "2026-01-01" }]);
  });
});

describe("porPrefixo / invalidar", () => {
  it("porPrefixo gera uma entrada por query já em cache sob o prefixo, ignorando as sem dado", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["itens", "a"], [1, 2]);
    queryClient.setQueryData(["itens", "b"], [3]);
    queryClient.setQueryData(["itens", "c"], undefined);

    const entradas = porPrefixo<number[]>(queryClient, ["itens"], (atual) => atual.map((n) => n * 10));

    expect(entradas).toHaveLength(2);
    for (const entrada of entradas) {
      expect(entrada.aplicar!(queryClient.getQueryData(entrada.queryKey), undefined)).toEqual(
        (queryClient.getQueryData(entrada.queryKey) as number[]).map((n) => n * 10),
      );
    }
  });

  it("invalidar devolve só a queryKey, sem aplicar", () => {
    expect(invalidar(["financeiro"])).toEqual({ queryKey: ["financeiro"] });
  });
});

describe("validado", () => {
  it("devolve o data do resultado bem-sucedido", () => {
    expect(validado({ success: true, data: { x: 1 } })).toEqual({ x: 1 });
  });

  it("lança ApiError 422 com o campo do primeiro issue", () => {
    expect(() => validado({ success: false, error: { issues: [{ message: "obrigatório", path: ["valor"] }] } }))
      .toThrow(expect.objectContaining({ name: "ApiError", status: 422, code: "VALIDACAO", campo: "valor" }));
  });
});
