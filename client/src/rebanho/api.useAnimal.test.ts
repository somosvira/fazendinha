// @vitest-environment jsdom
// Regressão de dois achados de teste manual offline na ficha do animal
// (AnimalCockpit): 1) lista e ficha usam o mesmo DTO (toAnimalDTO no
// server) — clicar num animal que já veio na lista cacheada deve renderizar
// a ficha na hora, sem depender de uma segunda ida ao servidor; 2) um animal
// nunca visitado (nem na ficha, nem em nenhuma lista cacheada) e offline não
// pode travar em "Carregando..." pra sempre — isPending fica true e
// fetchStatus vira "paused", então o loading tem que resolver mesmo assim
// (cai no fallback "Animal não encontrado" em vez de um spinner eterno).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useAnimal } from "./api";
import type { Animal } from "./types";

vi.mock("../lib/offline/req", () => ({
  req: vi.fn(() => Promise.reject(new Error("offline"))),
}));

const ANIMAL: Animal = {
  id: "7", numero: "1003", nome: "Estrela", sexo: "F", categoria: "VACA",
  finalidade: "LEITE", raca: "Girolando", dataNascimento: "2022-01-10",
  dataEntrada: "2022-01-10", ativo: true,
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useAnimal — leitura offline na ficha do animal", () => {
  it("usa o dado já cacheado de uma lista (useAnimais) como initialData, sem esperar fetch", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["rebanho", "animais", "ATIVO", null, null, null, null, null], [ANIMAL]);

    const { result } = renderHook(() => useAnimal(ANIMAL.id), { wrapper: wrapper(queryClient) });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(ANIMAL);
  });

  it("não trava em loading pra sempre quando offline e o animal nunca foi visitado (nem na ficha, nem em lista)", async () => {
    onlineManager.setOnline(false);
    try {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => useAnimal("999"), { wrapper: wrapper(queryClient) });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
