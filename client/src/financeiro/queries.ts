// Query keys e hooks de leitura do Financeiro (ver docs/design/offline/README.md).
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import {
  obterDashboardFinanceiro, obterConfiguracoesFinanceiras, listarOperacoes, obterOperacao,
  listarCompromissos, obterExtratoConta, obterExtratoGeral,
  listarRelatoriosFinanceiros, obterRelatorioFinanceiro, obterRascunhoRelatorioFinanceiro,
} from "./novo-api";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { listarSaldos, obterUltimoPreco, obterCustoMedio } from "../estoque/api";

// O sítio ativo é o 2º elemento de toda chave: cada sítio tem cache próprio e o
// prefixo ["financeiro"] / ["estoque"] continua alcançando todos.
const sitio = () => getPropriedadeAtiva();

export const financeiroKeys = {
  dashboardTodos: () => ["financeiro", sitio(), "dashboard"] as const,
  dashboard: (inicio?: string, fim?: string) => ["financeiro", sitio(), "dashboard", inicio ?? null, fim ?? null] as const,
  configuracoes: () => ["financeiro", sitio(), "configuracoes"] as const,
  operacoesTodos: () => ["financeiro", sitio(), "operacoes"] as const,
  operacoes: (filtros?: { inicio?: string; fim?: string }) => ["financeiro", sitio(), "operacoes", filtros?.inicio ?? null, filtros?.fim ?? null] as const,
  operacaoTodos: () => ["financeiro", sitio(), "operacao"] as const,
  operacao: (id: string) => ["financeiro", sitio(), "operacao", id] as const,
  compromissosTodos: () => ["financeiro", sitio(), "compromissos"] as const,
  compromissos: (periodo?: { inicio?: string; fim?: string }) => ["financeiro", sitio(), "compromissos", periodo?.inicio ?? null, periodo?.fim ?? null] as const,
  extrato: (contaId: string) => ["financeiro", sitio(), "extrato", contaId] as const,
  extratoGeral: () => ["financeiro", sitio(), "extrato-geral"] as const,
  relatoriosTodos: () => ["financeiro", sitio(), "relatorios"] as const,
  relatorio: (id: string) => ["financeiro", sitio(), "relatorio", id] as const,
  rascunhoRelatorio: () => ["financeiro", sitio(), "rascunho-relatorio"] as const,
};

/** Invalida tudo sob o prefixo `financeiro` (operações, compromissos, dashboard,
 *  configurações, extratos — inclusive por conta) numa chamada só. */
export function invalidarFinanceiro(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["financeiro"] });
}

export function useDashboardFinanceiro(inicio?: string, fim?: string) {
  return useQuery({ queryKey: financeiroKeys.dashboard(inicio, fim), queryFn: () => obterDashboardFinanceiro(inicio, fim), placeholderData: keepPreviousData });
}
export function useConfiguracoesFinanceiras(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.configuracoes(), queryFn: () => obterConfiguracoesFinanceiras(), enabled });
}
export function useOperacoesFinanceiras(filtros?: { inicio?: string; fim?: string }) {
  return useQuery({ queryKey: financeiroKeys.operacoes(filtros), queryFn: () => listarOperacoes(filtros), placeholderData: keepPreviousData });
}
export function useOperacaoFinanceira(id: string | null) {
  return useQuery({ queryKey: financeiroKeys.operacao(id ?? ""), queryFn: () => obterOperacao(id!), enabled: id != null });
}
export function useCompromissosFinanceiros(periodo?: { inicio?: string; fim?: string }) {
  return useQuery({ queryKey: financeiroKeys.compromissos(periodo), queryFn: () => listarCompromissos(periodo?.inicio && periodo.fim ? { inicio: periodo.inicio, fim: periodo.fim } : undefined), placeholderData: keepPreviousData });
}
export function useExtratoConta(contaId: string | null) {
  return useQuery({ queryKey: financeiroKeys.extrato(contaId ?? ""), queryFn: () => obterExtratoConta(contaId!), enabled: contaId != null });
}
export function useExtratoGeral(enabled = true) {
  return useQuery({ queryKey: financeiroKeys.extratoGeral(), queryFn: () => obterExtratoGeral(), enabled });
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
  saldosTodos: () => ["estoque", sitio(), "saldos"] as const,
  saldos: (f?: { centroCustoId?: string }) => ["estoque", sitio(), "saldos", f?.centroCustoId ?? null] as const,
  ultimoPreco: (produtoId: string, parceiroId?: string | null) => ["estoque", sitio(), "ultimo-preco", produtoId, parceiroId ?? null] as const,
  custoMedio: (produtoId: string) => ["estoque", sitio(), "custo-medio", produtoId] as const,
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
