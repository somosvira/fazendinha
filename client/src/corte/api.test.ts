// @vitest-environment jsdom
// Regressão: useLotes (dropdown de lote das telas de Pesagem/Sanidade) lia via
// useState + fetch direto — nunca entrava no queryClient, então nunca era
// persistido em IndexedDB (mesmo gap achado e corrigido em useFuncionarios,
// ver equipe/api.test.ts e OFFLINE_STRATEGY.md). Migrado pra useQuery; este
// teste prova que o dado restaurado do cache sobrevive a um fetch que falha
// (offline). Cobre também a config de useRegistrarPesagem — a fatia de escrita
// nova desta PR — provando que o item otimista entra na Timeline certa.
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useLotes, useRegistrarPesagem } from "./api";
import type { Lote, EventoTimeline } from "./types";

vi.mock("../lib/offline/req", () => ({
  req: vi.fn(() => Promise.reject(new Error("offline"))),
}));

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
  };
});

const LOTE: Lote = {
  id: "1",
  codigo: "REC-A",
  nome: "Recria A",
  categoria: "GAROTE",
  fase: "RECRIA",
  raca: "Nelore",
  numCabecas: 40,
  numCabecasEntrada: 42,
  dataFormacao: "2026-01-10",
  estado: "ATIVO",
  resumo: { loteId: "1", pesoMedio: 280 },
};

describe("useLotes — leitura via cache persistido", () => {
  it("mantém a lista restaurada do cache mesmo com o fetch de fundo falhando (F5 offline)", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Simula o que o persister (IndexedDB) já teria restaurado — mesma chave
    // que corteKeys.lotes({estado:"ATIVO"}) monta.
    queryClient.setQueryData(["corte", "lotes", "ATIVO", null, null], [LOTE]);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useLotes({ estado: "ATIVO" }), { wrapper });

    // Já no primeiro render, antes do fetch (que vai falhar) resolver.
    expect(result.current.data).toEqual([LOTE]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    // O erro do refetch de fundo não apaga o dado cacheado.
    expect(result.current.data).toEqual([LOTE]);
  });
});

describe("useRegistrarPesagem — patch otimista na Timeline do lote", () => {
  it("registra o item otimista em corteKeys.eventos(loteId) com título/data corretos", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const eventosKey = ["corte", "eventos", "1"];
    queryClient.setQueryData<EventoTimeline[]>(eventosKey, []);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useRegistrarPesagem(), { wrapper });

    result.current.mutate({
      loteId: "1",
      data: "2026-08-27",
      pesoMedio: 312,
      numCabecas: 40,
      metodo: "BALANCA_LOTE",
    });

    const eventos = queryClient.getQueryData<EventoTimeline[]>(eventosKey);
    expect(eventos).toHaveLength(1);
    expect(eventos?.[0]).toMatchObject({
      loteId: "1",
      data: "2026-08-27",
      dominio: "pesagem",
      titulo: "Pesagem do lote",
    });
  });
});
