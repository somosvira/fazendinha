import { useCallback, useEffect, useState } from "react";
import { comPropriedade } from "../propriedadeScope";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) || {}) };
  if (init?.body) headers["content-type"] = "application/json";
  const res = await fetch(`/api${path}`, { ...init, headers: comPropriedade(headers) });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: número duplicado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  return res.json();
}

// monta a query string a partir de um objeto (ignora undefined/null/"") — ?a=1&b=2 ou ""
function qs(f?: object): string {
  if (!f) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Centros de custo "de atividade" (leite/café) — usados pelos módulos rebanho/
// plantio para pré-filtrar a tela de Estoque. Rota própria (não atrás do gate
// de área "financeiro"), montada sob /api/estoque/* (pecuaria|agricultura|financeiro).
export interface CentrosAtividadeDTO { leite: number | null; cafe: number | null }
export const obterCentrosAtividade = () => req<CentrosAtividadeDTO>("/estoque/centros-atividade");

// ── Estoque: saldos + movimentos + custo vaca/dia ───────────────────────────
export interface SaldoDTO { produtoId: number; nome: string; tipo: string; unidade: string; centrosCusto: { id: number; nome: string }[]; saldo: number; valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export type OrigemMovimento = "COMPRA" | "CONSUMO_DIRETO" | "TRANSFERENCIA" | "PRODUCAO" | "DEVOLUCAO" | "BONIFICACAO" | "INVENTARIO_INICIAL" | "NUTRICAO" | "SANIDADE" | "PERDA" | "AJUSTE_INVENTARIO" | "APLICACAO";
export interface MovimentoDTO { id: number; produtoId: number; produto: string; centrosCusto: { id: number; nome: string }[]; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; origem: OrigemMovimento; status: "CONFIRMADO" | "REVERTIDO"; reversaoDeId: number | null; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null; }
export interface MovimentoInput { produtoId: number; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; fornecedorId?: number; observacao?: string; gerarLancamento?: boolean; categoriaId?: number; centroCustoId?: number; }
export interface MovimentoResult { id: number; lancamentoCriado: boolean; lancamentoId?: number; motivo?: string; }
export interface CustoVacaDia { periodoDias: number; custoVacaDia: number | null; vacasEmLactacao: number; totalConsumo: number; }

export const listarSaldos = (f?: { centroCustoId?: number | string }) => req<SaldoDTO[]>(`/estoque/saldos${qs(f)}`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<MovimentoResult>(`/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export interface AjusteContagemInput { produtoId: number; quantidadeContada: number; saldoEsperado: number; observacao: string; }
export const ajustarContagem = (p: AjusteContagemInput) => req<{ id: number; operacaoId: number; saldoAnterior: number; quantidadeContada: number; diferenca: number }>(`/estoque/ajustes`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/estoque/movimentos/${id}`, { method: "DELETE" });
export const obterCustoVacaDia = (dias = 30) => req<CustoVacaDia>(`/estoque/custo-vaca-dia?dias=${dias}`);

export function useSaldos(f?: { centroCustoId?: number | string }) {
  const [data, setData] = useState<SaldoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarSaldos(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useCustoVacaDia(dias = 30) {
  const [data, setData] = useState<CustoVacaDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterCustoVacaDia(dias).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [dias]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}
