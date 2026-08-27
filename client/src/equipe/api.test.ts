// @vitest-environment jsdom
// Regressão do gap reportado em teste manual: F5 offline zerava o dropdown
// de funcionário na tela de Ponto porque useFuncionarios lia via useState +
// fetch direto (nunca entrava no queryClient, então nunca era persistido em
// IndexedDB — ver persister.ts). Migrado pra useQuery; este teste prova que
// o dado restaurado do cache sobrevive a um fetch que falha (offline).
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useFuncionarios } from "./api";
import type { FuncionarioDTO } from "./types";

vi.mock("../lib/offline/req", () => ({
  req: vi.fn(() => Promise.reject(new Error("offline"))),
}));

const FUNCIONARIO: FuncionarioDTO = {
  id: "1",
  nome: "Maria",
  cargo: "Ordenhadora",
  setor: "Leite",
  salarioMensal: 2200,
  cargaMensalHoras: 220,
  jornadaDiariaHoras: 8,
  horaEntradaPadrao: "06:00",
  horaSaidaPadrao: "15:00",
  intervaloPadraoMin: 60,
  dataAdmissao: "2024-01-10",
  cpf: null,
  chavePix: null,
  ativo: true,
};

describe("useFuncionarios — leitura via cache persistido", () => {
  it("mantém a lista restaurada do cache mesmo com o fetch de fundo falhando (F5 offline)", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Simula o que o persister (IndexedDB) já teria restaurado antes deste
    // hook montar — mesmo mecanismo real do PersistQueryClientProvider.
    queryClient.setQueryData(["ponto", "funcionarios", true], [FUNCIONARIO]);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useFuncionarios(true), { wrapper });

    // Já no primeiro render, antes do fetch (que vai falhar) resolver.
    expect(result.current.data).toEqual([FUNCIONARIO]);

    await waitFor(() => expect(result.current.erro).toBe("offline"));
    // O erro do refetch de fundo não apaga o dado cacheado.
    expect(result.current.data).toEqual([FUNCIONARIO]);
  });
});
