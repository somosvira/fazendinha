// Query keys e hooks de leitura do Financeiro (ver docs/design/offline/README.md).
import { useQuery } from "@tanstack/react-query";
import {
  obterDashboardFinanceiro, obterConfiguracoesFinanceiras, listarOperacoes, obterOperacao,
  listarCompromissos, obterExtratoConta, obterExtratoGeral, obterRascunhoOperacao,
  listarRelatoriosFinanceiros, obterRelatorioFinanceiro, obterRascunhoRelatorioFinanceiro,
} from "./novo-api";
import { listarSaldos, obterUltimoPreco, obterCustoMedio } from "../estoque/api";

export const financeiroKeys = {
  dashboardTodos: () => ["financeiro", "dashboard"] as const,
  dashboard: (inicio?: string, fim?: string) => ["financeiro", "dashboard", inicio ?? null, fim ?? null] as const,
  configuracoes: () => ["financeiro", "configuracoes"] as const,
  operacoesTodos: () => ["financeiro", "operacoes"] as const,
  operacoes: (filtros?: { inicio?: string; fim?: string }) => ["financeiro", "operacoes", filtros?.inicio ?? null, filtros?.fim ?? null] as const,
  operacao: (id: string) => ["financeiro", "operacao", id] as const,
  compromissosTodos: () => ["financeiro", "compromissos"] as const,
  compromissos: (periodo?: { inicio?: string; fim?: string }) => ["financeiro", "compromissos", periodo?.inicio ?? null, periodo?.fim ?? null] as const,
  extrato: (contaId: string) => ["financeiro", "extrato", contaId] as const,
  extratoGeral: () => ["financeiro", "extrato-geral"] as const,
  rascunho: () => ["financeiro", "rascunho"] as const,
  relatoriosTodos: () => ["financeiro", "relatorios"] as const,
  relatorio: (id: string) => ["financeiro", "relatorio", id] as const,
  rascunhoRelatorio: () => ["financeiro", "rascunho-relatorio"] as const,
};

export function useDashboardFinanceiro(inicio?: string, fim?: string) {
  return useQuery({ queryKey: financeiroKeys.dashboard(inicio, fim), queryFn: () => obterDashboardFinanceiro(inicio, fim) });
}
export function useConfiguracoesFinanceiras(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.configuracoes(), queryFn: () => obterConfiguracoesFinanceiras(), enabled });
}
export function useOperacoesFinanceiras(filtros?: { inicio?: string; fim?: string }) {
  return useQuery({ queryKey: financeiroKeys.operacoes(filtros), queryFn: () => listarOperacoes(filtros) });
}
export function useOperacaoFinanceira(id: string | null) {
  return useQuery({ queryKey: financeiroKeys.operacao(id ?? ""), queryFn: () => obterOperacao(id!), enabled: id != null });
}
export function useCompromissosFinanceiros(periodo?: { inicio?: string; fim?: string }) {
  return useQuery({ queryKey: financeiroKeys.compromissos(periodo), queryFn: () => listarCompromissos(periodo?.inicio && periodo.fim ? { inicio: periodo.inicio, fim: periodo.fim } : undefined) });
}
export function useExtratoConta(contaId: string | null) {
  return useQuery({ queryKey: financeiroKeys.extrato(contaId ?? ""), queryFn: () => obterExtratoConta(contaId!), enabled: contaId != null });
}
export function useExtratoGeral(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.extratoGeral(), queryFn: () => obterExtratoGeral(), enabled });
}
export function useRascunhoOperacao(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.rascunho(), queryFn: () => obterRascunhoOperacao(), enabled });
}
export function useRelatoriosFinanceiros() {
  return useQuery({ queryKey: financeiroKeys.relatoriosTodos(), queryFn: () => listarRelatoriosFinanceiros() });
}
export function useRelatorioFinanceiro(id: string | null) {
  return useQuery({ queryKey: financeiroKeys.relatorio(id ?? ""), queryFn: () => obterRelatorioFinanceiro(id!), enabled: id != null });
}
export function useRascunhoRelatorioFinanceiro(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.rascunhoRelatorio(), queryFn: () => obterRascunhoRelatorioFinanceiro(), enabled });
}

// ── Estoque: leituras usadas pelo FormOperacao ──
export const estoqueKeys = {
  saldosTodos: () => ["estoque", "saldos"] as const,
  saldos: (f?: { centroCustoId?: string }) => ["estoque", "saldos", f?.centroCustoId ?? null] as const,
  ultimoPreco: (produtoId: string, parceiroId?: string | null) => ["estoque", "ultimo-preco", produtoId, parceiroId ?? null] as const,
  custoMedio: (produtoId: string) => ["estoque", "custo-medio", produtoId] as const,
};

export function useSaldosEstoque(f?: { centroCustoId?: string }) {
  return useQuery({ queryKey: estoqueKeys.saldos(f), queryFn: () => listarSaldos(f) });
}
export function useUltimoPrecoProduto(produtoId: string | null, parceiroId?: string | null) {
  return useQuery({ queryKey: estoqueKeys.ultimoPreco(produtoId ?? "", parceiroId), queryFn: () => obterUltimoPreco(produtoId!, parceiroId), enabled: produtoId != null });
}
export function useCustoMedioProduto(produtoId: string | null) {
  return useQuery({ queryKey: estoqueKeys.custoMedio(produtoId ?? ""), queryFn: () => obterCustoMedio(produtoId!), enabled: produtoId != null });
}
