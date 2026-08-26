/* Camada de leitura/escrita do módulo Cultivo (milho).
 *
 * Espelha o pattern de client/src/plantio/api.ts: cada `useXxx()` bate em
 * `/api/cultivo/*` via o helper `req<T>`, que prefixa `/api`, injeta
 * `content-type` quando há corpo e extrai a mensagem de erro de `{error}`
 * (service) ou `{error:{issues}}` (ZodError do zValidator). Os hooks mantêm
 * o contrato `{data, loading, erro, recarregar}` — a forma dos DTOs (./types)
 * espelha server/src/services/cultivo/mappers.ts.
 */

import { useEffect, useState, useCallback } from "react";
import type {
  SafraCultivo,
  AreaCultivo,
  LancamentoCusto,
  ProducaoCultivo,
  Silo,
  MovimentoSilo,
  ResumoSafraCultivoComTotal,
  ClasseFiltro,
  Cultura,
  ClassificacaoCategoria,
  TipoCustoCultivo,
  TipoProducao,
  UnidadeProducao,
  DestinoProducao,
  TipoSilo,
  TipoMovimentoSilo,
  OrigemMovimentoSilo,
} from "./types";
import { req } from "../lib/offline/req";

// monta a query string a partir de um objeto (ignora undefined/null/"") — ?a=1&b=2 ou ""
function qs(f?: Record<string, string | number | boolean | undefined | null>): string {
  if (!f) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// PAYLOADS DE ESCRITA -------------------------------------------------------
// Espelham os schemas Zod em server/src/services/cultivo/schemas.ts.

export interface SafraCultivoInput {
  cultura: Cultura;
  nome: string;
  ano: number;
  dataInicio: string;              // YYYY-MM-DD
  dataFim?: string | null;
  areaHaTotal?: number | null;
  observacao?: string | null;
}

export interface AreaCultivoInput {
  safraCultivoId: number;
  codigo: string;
  nome?: string | null;
  areaHa: number;
}

export interface LancamentoCustoInput {
  safraCultivoId: number;
  areaCultivoId?: number | null;
  tipo: TipoCustoCultivo;
  classe?: ClassificacaoCategoria;
  data: string;                    // YYYY-MM-DD
  descricao: string;
  valor: number;
  qtd?: number | null;
  unidade?: string | null;
  horasMaquina?: number | null;
  numMaquinas?: number | null;
  numCaminhoes?: number | null;
  observacao?: string | null;
}

export interface ProducaoCultivoInput {
  safraCultivoId: number;
  areaCultivoId?: number | null;
  data: string;                    // YYYY-MM-DD
  tipo: TipoProducao;
  quantidade: number;
  unidade: UnidadeProducao;
  destino?: DestinoProducao | null;
  siloId?: number | null;
  observacao?: string | null;
}

export interface SiloInput {
  nome: string;
  tipo: TipoSilo;
  capacidade?: number | null;
  unidade: string;
  ativo?: boolean;
}

export interface MovimentoSiloInput {
  data: string;                    // YYYY-MM-DD
  tipo: TipoMovimentoSilo;
  quantidade: number;
  origem: OrigemMovimentoSilo;
  observacao?: string | null;
}

// SAFRAS --------------------------------------------------------------------

export const listarSafrasCultivo = (f?: { cultura?: Cultura; fechada?: boolean; ano?: number }) =>
  req<SafraCultivo[]>(`/cultivo/safras${qs(f)}`);
export const obterSafraCultivo = (id: number) => req<SafraCultivo>(`/cultivo/safras/${id}`);
export const criarSafraCultivo = (input: SafraCultivoInput) =>
  req<SafraCultivo>(`/cultivo/safras`, { method: "POST", body: JSON.stringify(input) });
export const editarSafraCultivo = (id: number, input: Partial<SafraCultivoInput>) =>
  req<SafraCultivo>(`/cultivo/safras/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirSafraCultivo = (id: number) =>
  req<void>(`/cultivo/safras/${id}`, { method: "DELETE" });
export const fecharSafraCultivo = (id: number) =>
  req<SafraCultivo>(`/cultivo/safras/${id}/fechar`, { method: "POST" });
export const reabrirSafraCultivo = (id: number) =>
  req<SafraCultivo>(`/cultivo/safras/${id}/reabrir`, { method: "POST" });
export const obterResumoSafraCultivo = (id: number, classe?: ClasseFiltro) =>
  req<ResumoSafraCultivoComTotal>(`/cultivo/safras/${id}/resumo${qs({ classe })}`);

export function useSafrasCultivo(f?: { cultura?: Cultura; fechada?: boolean; ano?: number }) {
  const [data, setData] = useState<SafraCultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarSafrasCultivo(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useSafraCultivo(id: number | null) {
  const [data, setData] = useState<SafraCultivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (id == null) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterSafraCultivo(id).then(setData).catch((e) => { setErro(e.message); setData(null); }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useResumoSafraCultivo(id: number | null, classe?: ClasseFiltro) {
  const [data, setData] = useState<ResumoSafraCultivoComTotal | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (id == null) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterResumoSafraCultivo(id, classe).then(setData).catch((e) => { setErro(e.message); setData(null); }).finally(() => setLoading(false));
  }, [id, classe]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ÁREAS -----------------------------------------------------------------

export const listarAreasCultivo = (f?: { safraCultivoId?: number }) =>
  req<AreaCultivo[]>(`/cultivo/areas${qs(f)}`);
export const obterAreaCultivo = (id: number) => req<AreaCultivo>(`/cultivo/areas/${id}`);
export const criarAreaCultivo = (input: AreaCultivoInput) =>
  req<AreaCultivo>(`/cultivo/areas`, { method: "POST", body: JSON.stringify(input) });
export const editarAreaCultivo = (id: number, input: Partial<Omit<AreaCultivoInput, "safraCultivoId">>) =>
  req<AreaCultivo>(`/cultivo/areas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirAreaCultivo = (id: number) =>
  req<void>(`/cultivo/areas/${id}`, { method: "DELETE" });

export function useAreasCultivo(safraCultivoId?: number | null) {
  const [data, setData] = useState<AreaCultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarAreasCultivo(safraCultivoId != null ? { safraCultivoId } : undefined)
      .then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [safraCultivoId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// CUSTOS ------------------------------------------------------------------

export const listarLancamentosCusto = (f?: { safraCultivoId?: number; areaCultivoId?: number; classe?: ClasseFiltro }) =>
  req<LancamentoCusto[]>(`/cultivo/custos${qs(f)}`);
export const obterLancamentoCusto = (id: number) => req<LancamentoCusto>(`/cultivo/custos/${id}`);
export const criarLancamentoCusto = (input: LancamentoCustoInput) =>
  req<LancamentoCusto>(`/cultivo/custos`, { method: "POST", body: JSON.stringify(input) });
export const editarLancamentoCusto = (id: number, input: Partial<Omit<LancamentoCustoInput, "safraCultivoId">>) =>
  req<LancamentoCusto>(`/cultivo/custos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirLancamentoCusto = (id: number) =>
  req<void>(`/cultivo/custos/${id}`, { method: "DELETE" });

export function useLancamentosCusto(f?: { safraCultivoId?: number; areaCultivoId?: number; classe?: ClasseFiltro }) {
  const [data, setData] = useState<LancamentoCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarLancamentosCusto(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// PRODUÇÃO ------------------------------------------------------------------

export const listarProducoesCultivo = (f?: { safraCultivoId?: number; areaCultivoId?: number }) =>
  req<ProducaoCultivo[]>(`/cultivo/producao${qs(f)}`);
export const obterProducaoCultivo = (id: number) => req<ProducaoCultivo>(`/cultivo/producao/${id}`);
export const criarProducaoCultivo = (input: ProducaoCultivoInput) =>
  req<ProducaoCultivo>(`/cultivo/producao`, { method: "POST", body: JSON.stringify(input) });
export const editarProducaoCultivo = (id: number, input: Partial<Omit<ProducaoCultivoInput, "safraCultivoId">>) =>
  req<ProducaoCultivo>(`/cultivo/producao/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirProducaoCultivo = (id: number) =>
  req<void>(`/cultivo/producao/${id}`, { method: "DELETE" });

export function useProducoesCultivo(f?: { safraCultivoId?: number; areaCultivoId?: number }) {
  const [data, setData] = useState<ProducaoCultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarProducoesCultivo(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// SILOS ---------------------------------------------------------------------

export const listarSilos = (f?: { tipo?: TipoSilo; ativo?: boolean }) =>
  req<Silo[]>(`/cultivo/silos${qs(f)}`);
export const obterSilo = (id: number) => req<Silo>(`/cultivo/silos/${id}`);
export const criarSilo = (input: SiloInput) =>
  req<Silo>(`/cultivo/silos`, { method: "POST", body: JSON.stringify(input) });
export const editarSilo = (id: number, input: Partial<SiloInput>) =>
  req<Silo>(`/cultivo/silos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirSilo = (id: number) =>
  req<void>(`/cultivo/silos/${id}`, { method: "DELETE" });
export const listarMovimentosSilo = (siloId: number) =>
  req<MovimentoSilo[]>(`/cultivo/silos/${siloId}/movimentos`);
export const criarMovimentoSilo = (siloId: number, input: MovimentoSiloInput) =>
  req<MovimentoSilo>(`/cultivo/silos/${siloId}/movimentos`, { method: "POST", body: JSON.stringify(input) });
export const excluirMovimentoSilo = (siloId: number, movimentoId: number) =>
  req<void>(`/cultivo/silos/${siloId}/movimentos/${movimentoId}`, { method: "DELETE" });

export function useSilos(f?: { tipo?: TipoSilo; ativo?: boolean }) {
  const [data, setData] = useState<Silo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarSilos(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useMovimentosSilo(siloId: number | null) {
  const [data, setData] = useState<MovimentoSilo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (siloId == null) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarMovimentosSilo(siloId).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [siloId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// DASHBOARD ---------------------------------------------------------------
// Espelha DashboardCultivoDTO (server/src/services/cultivo/dashboard.agg.ts).

export interface DashboardMilho {
  k: {
    safrasAtivas: number;
    safrasFechadas: number;
    areaHa: number;
    producaoGraoSc: number;
    producaoSilagemTon: number;
    custeioTotal: number;
    investimentoTotal: number;
    custoSacaMedio: number | null;
    silosAtivos: number;
    siloSaldoTotal: number;
    siloOcupacaoPct: number | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export const obterDashboard = () => req<DashboardMilho>(`/cultivo/dashboard`);

export function useDashboard() {
  const [data, setData] = useState<DashboardMilho | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    obterDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}
