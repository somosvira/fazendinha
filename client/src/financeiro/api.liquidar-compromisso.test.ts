// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { financeiroKeys, useLiquidarCompromisso, type Compromisso, type Conta, type ConfiguracoesFinanceiras } from "./novo-api";

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

const contaBase: Conta = {
  id: 3, nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null,
  saldoAbertura: "1000", dataSaldoAbertura: "2026-01-01", saldoAtual: "5000", incluirNoSaldoGeral: true, ativo: true,
};
const configBase: ConfiguracoesFinanceiras = { contas: [contaBase], parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [] };

describe("useLiquidarCompromisso — patch otimista e invalidação", () => {
  it("liquidação parcial: soma no valorLiquidado, reduz saldoPendente e marca PARCIAL", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 400, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[0]).toMatchObject({ valorLiquidado: "400", saldoPendente: "600", status: "PARCIAL" });
  });

  it("liquidação que zera o saldo marca LIQUIDADO", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 1000, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[0]).toMatchObject({ valorLiquidado: "1000", saldoPendente: "0", status: "LIQUIDADO" });
  });

  it("não mexe em outro compromisso da mesma lista", async () => {
    const outro: Compromisso = { ...compromissoBase, id: 11, valorOriginal: "500", saldoPendente: "500" };
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase, outro]);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 200, data: "2026-09-08" });

    const lista = queryClient.getQueryData<Compromisso[]>(financeiroKeys.compromissos())!;
    expect(lista[1]).toEqual(outro);
  });

  it("invalida extrato da conta e dashboard (todos os períodos) após o sync", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);
    queryClient.setQueryData(financeiroKeys.extrato(3), []);
    queryClient.setQueryData(financeiroKeys.dashboard("2026-09-01", "2026-09-30"), { fake: "dashboard" });
    queryClient.setQueryData(financeiroKeys.configuracoes(), configBase);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 400, data: "2026-09-08" });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.extrato(3) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboardTodos() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.configuracoes() });
    });
    expect(queryClient.getQueryState(financeiroKeys.dashboard("2026-09-01", "2026-09-30"))?.isInvalidated).toBe(true);
  });

  it("PAGAR reduz o saldoAtual da conta em `configuracoes` na hora", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);
    queryClient.setQueryData(financeiroKeys.configuracoes(), configBase);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 400, data: "2026-09-08" });

    const config = queryClient.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!;
    expect(config.contas[0].saldoAtual).toBe("4600");
  });

  it("RECEBER aumenta o saldoAtual da conta em `configuracoes`", () => {
    const compromissoReceber: Compromisso = { ...compromissoBase, id: 12, tipo: "RECEBER" };
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoReceber]);
    queryClient.setQueryData(financeiroKeys.configuracoes(), configBase);

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ compromissoId: 12, tipo: "RECEBER", contaId: 3, valor: 400, data: "2026-09-08" });

    const config = queryClient.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes())!;
    expect(config.contas[0].saldoAtual).toBe("5400");
  });

  it("não quebra quando `configuracoes` nunca foi buscado (undefined)", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeiroKeys.compromissos(), [compromissoBase]);
    // Sem setQueryData(configuracoes()) — simula offline, nunca visitado.

    const { result } = renderHook(() => useLiquidarCompromisso(), { wrapper: wrapper(queryClient) });
    expect(() => result.current.mutate({ compromissoId: 10, tipo: "PAGAR", contaId: 3, valor: 400, data: "2026-09-08" })).not.toThrow();
    expect(queryClient.getQueryData(financeiroKeys.configuracoes())).toBeUndefined();
  });
});
