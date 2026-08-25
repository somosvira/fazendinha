/* Camada de leitura/escrita do módulo Equipe & Ponto.
 *
 * Espelha o pattern do Plantio/Rebanho: cada `useXxx()` bate em `/api/ponto/*`
 * via o helper `req<T>`, que prefixa `/api`, injeta `content-type` quando há
 * corpo e extrai a mensagem de erro de `{error}` (service) ou `{error:{issues}}`
 * (ZodError do zValidator). Os hooks mantêm o contrato `{data, loading, erro,
 * recarregar}`. Os DTOs (./types) não mudam.
 *
 * Formulários enviam `undefined` para opcionais vazios (nunca `null`); enums
 * em UPPERCASE.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FuncionarioDTO, RegistroDTO, FolhaDTO, CustoMOSetorDTO } from "./types";
import { comPropriedade } from "../propriedadeScope";
import { fmtMoneyExact } from "../components/charts";
import {
  useOfflineMutation,
  registrarMutationDefaults,
  criarIdTemporario,
  type UseOfflineMutationConfig,
} from "../lib/offline/useOfflineMutation";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = comPropriedade({
    ...((init?.headers as Record<string, string>) || {}),
    ...(init?.body ? { "content-type": "application/json" } : {}),
  });
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: registro em mês fechado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  return res.json();
}

// monta a query string a partir de um objeto (ignora undefined/null/"") — ?a=1&b=2 ou ""
function qs(f?: Record<string, string | number | boolean | undefined | null>): string {
  if (!f) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// PAYLOADS DE ESCRITA -----------------------------------------------------

// Body aceito por POST /api/ponto/funcionarios (e PATCH /:id como Partial).
// Opcionais vazios devem ir como `undefined` (o form omite), nunca `null`.
export interface FuncionarioInput {
  nome: string;
  cargo?: string;
  setor?: string;   // setor operacional (livre); omitido/"" = sem setor
  salarioMensal: number;
  cargaMensalHoras: number;
  jornadaDiariaHoras: number;
  horaEntradaPadrao?: string;   // HH:MM
  horaSaidaPadrao?: string;     // HH:MM
  intervaloPadraoMin?: number;
  dataAdmissao?: string;   // YYYY-MM-DD
  cpf?: string;
  chavePix?: string;
}

// Body de upsert de registro de ponto — POST /api/ponto/registros. Único por
// (funcionarioId, data): reenviar a mesma data sobrescreve.
export interface RegistroInput {
  funcionarioId: string;
  data: string;            // YYYY-MM-DD
  entrada?: string;        // HH:MM
  saida?: string;          // HH:MM
  intervaloMin?: number;
  tipoDia?: string;        // TipoDiaPonto (UPPERCASE)
  observacao?: string;
}

// FUNCIONÁRIOS ------------------------------------------------------------

export const listarFuncionarios = (ativo?: boolean, setor?: string) =>
  req<FuncionarioDTO[]>(`/ponto/funcionarios${qs({ ativo, setor })}`);
// Custo de MO agregado por setor (só ativos; sem setor → "Geral"; total desc).
export const obterCustoMOSetor = () => req<CustoMOSetorDTO[]>(`/ponto/custo-mo-setor`);
export const obterFuncionario = (id: string) => req<FuncionarioDTO>(`/ponto/funcionarios/${id}`);
export const criarFuncionario = (input: FuncionarioInput) =>
  req<FuncionarioDTO>(`/ponto/funcionarios`, { method: "POST", body: JSON.stringify(input) });
export const editarFuncionario = (id: string, input: Partial<FuncionarioInput>) =>
  req<FuncionarioDTO>(`/ponto/funcionarios/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const baixarFuncionario = (id: string) =>
  req<FuncionarioDTO>(`/ponto/funcionarios/${id}/baixa`, { method: "POST" });
// Pré-preenche a grade do mês (ano + mes 1-12) com o horário padrão do
// funcionário. Idempotente. Devolve quantos dias criou + a grade recalculada.
export const preencherGrade = (funcionarioId: string, ano: number, mes: number) =>
  req<{ criados: number; registros: RegistroDTO[] }>(
    `/ponto/funcionarios/${funcionarioId}/preencher-grade`,
    { method: "POST", body: JSON.stringify({ ano, mes }) }
  );

// REGISTROS DE PONTO ------------------------------------------------------

export const listarRegistros = (funcionarioId: string, mes: string) =>
  req<RegistroDTO[]>(`/ponto/registros${qs({ funcionarioId, mes })}`);
export const upsertRegistro = (input: RegistroInput) =>
  req<RegistroDTO>(`/ponto/registros`, { method: "POST", body: JSON.stringify(input) });
export const excluirRegistro = (id: string) =>
  req<{ ok: true }>(`/ponto/registros/${id}`, { method: "DELETE" });

// FOLHA -------------------------------------------------------------------

export const obterFolha = (mes: string) => req<FolhaDTO>(`/ponto/folha${qs({ mes })}`);

// HOOKS -------------------------------------------------------------------

// Os hooks abaixo usam uma flag `cancelado` no cleanup do useEffect — diferente
// do padrão de rebanho/plantio (sem abort). Motivo: aqui o usuário troca mês/
// funcionário com frequência e uma resposta antiga chegar depois da nova
// sobrescreve a folha na tela. `recarregar` continua manual (não cancela).
export function useFuncionarios(ativo?: boolean) {
  const [data, setData] = useState<FuncionarioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarFuncionarios(ativo).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [ativo]);
  useEffect(() => {
    let cancelado = false;
    setLoading(true); setErro(null);
    listarFuncionarios(ativo)
      .then((d) => { if (!cancelado) setData(d); })
      .catch((e) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [ativo]);
  return { data, loading, erro, recarregar };
}

// Query key factory do módulo (padrão TanStack) — fonte única pras keys de
// Ponto, usada aqui e em useUpsertRegistro. `as const` dá tupla literal, não
// `unknown[]` — evita duas chamadas montarem "a mesma" key com formato
// diferente (isso criaria duas entradas de cache separadas, silenciosamente).
// `mes` em `registros` é "YYYY-MM", casa com o prefixo de `data` ("YYYY-MM-DD").
const pontoKeys = {
  registros: (funcionarioId: string, mes: string) => ["ponto", "registros", funcionarioId, mes] as const,
  upsertRegistro: ["ponto", "upsert-registro"] as const,
};

// Config única — usada tanto pelo registro de escopo de módulo (abaixo)
// quanto pelo hook (useUpsertRegistro), pra nunca divergir entre os dois
// caminhos. `op: "upsert"` porque a identidade não é um id — é a chave
// natural (funcionarioId, data): reenviar a mesma data sobrescreve. Não
// usa `scopeId`/`resolverIds` (default: isolado por mutationKey) porque
// nenhuma outra escrita do Ponto referencia um registro por id.
const configUpsertRegistro: UseOfflineMutationConfig<RegistroInput, RegistroDTO> = {
  mutationKey: pontoKeys.upsertRegistro,
  mutationFn: upsertRegistro,
  queryKeys: (input) => [pontoKeys.registros(input.funcionarioId, input.data.slice(0, 7))],
  op: "upsert",
  match: (item, input) => item.data === input.data,
  // Campos computados pelo backend (horas/extra) entram zerados — o
  // apuramento é feito no servidor; corrige sozinho no refetch pós-sync.
  criarOtimista: (input) => ({
    id: criarIdTemporario(),
    funcionarioId: input.funcionarioId,
    data: input.data,
    entrada: input.entrada ?? null,
    saida: input.saida ?? null,
    intervaloMin: input.intervaloMin ?? 60,
    tipoDia: input.tipoDia ?? "UTIL",
    observacao: input.observacao ?? null,
    horas: 0,
    extra50: 0,
    extra100: 0,
  }),
};

// Escopo de módulo, não dentro do hook — garante que uma escrita de Ponto
// pausada offline consegue retomar no boot mesmo que o app tenha aberto
// numa aba diferente (PontoTab nunca chegou a montar nesta sessão). Roda
// garantido: App.tsx importa este módulo estaticamente (sem lazy), então
// esta linha executa no carregamento do bundle. Ver lib/offline/useOfflineMutation.ts.
registrarMutationDefaults(configUpsertRegistro);

// Migrado pra TanStack Query (Fatia 3 do plano offline — ver
// OFFLINE_STRATEGY.md). Mantém o contrato {data, loading, erro, recarregar}
// pra não precisar tocar em quem já consome o hook. Fica cacheado em
// IndexedDB (fundação em lib/offline/) — reabre offline com o último dado
// visto, mesmo sem rede.
export function useRegistros(funcionarioId: string | null, mes: string) {
  const query = useQuery({
    queryKey: pontoKeys.registros(funcionarioId ?? "", mes),
    queryFn: () => listarRegistros(funcionarioId!, mes),
    enabled: !!funcionarioId,
  });
  return {
    data: query.data ?? [],
    loading: funcionarioId ? query.isPending : false,
    erro: query.error ? (query.error as Error).message : null,
    recarregar: query.refetch,
  };
}

// Upsert de registro — offline-aware via useOfflineMutation (ver
// lib/offline/useOfflineMutation.ts): otimista na lista de `registros` do
// funcionário+mês, sobrevive a fechar o app offline, reconcilia com o
// servidor (id real + horas apuradas) ao sincronizar.
export function useUpsertRegistro() {
  return useOfflineMutation(configUpsertRegistro);
}

export function useFolha(mes: string) {
  const [data, setData] = useState<FolhaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterFolha(mes).then(setData).catch((e) => { setErro(e.message); setData(null); }).finally(() => setLoading(false));
  }, [mes]);
  useEffect(() => {
    let cancelado = false;
    setLoading(true); setErro(null);
    obterFolha(mes)
      .then((d) => { if (!cancelado) setData(d); })
      .catch((e) => { if (!cancelado) { setErro(e.message); setData(null); } })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [mes]);
  return { data, loading, erro, recarregar };
}

// Custo de MO por setor (só ativos). Recarrega manualmente após salvar/baixar
// funcionário — o total depende do quadro ativo.
export function useCustoMOSetor() {
  const [data, setData] = useState<CustoMOSetorDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterCustoMOSetor().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let cancelado = false;
    setLoading(true); setErro(null);
    obterCustoMOSetor()
      .then((d) => { if (!cancelado) setData(d); })
      .catch((e) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, []);
  return { data, loading, erro, recarregar };
}

// FORMATADORES (pt-BR) ----------------------------------------------------

export const money = fmtMoneyExact;
export const moneyN = (n: number | null | undefined) => (n == null ? "—" : money(n));
export const num = (n: number, casas = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const horasFmt = (n: number) => `${num(n, 1)} h`;
// "2026-05-13" → "13/05/2026"
export const dateBR = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "—");
// "2026-05" → "mai/2026"
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesBR = (mes: string) => {
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${MESES[idx]}/${y}` : mes;
};

// CALENDÁRIO / DIA-DA-SEMANA ----------------------------------------------

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Índice 0..6 do dia-da-semana de uma data "YYYY-MM-DD" (UTC — evita drift de fuso).
export function weekday(dataISO: string): number {
  const [y, m, d] = dataISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export const weekdayBR = (dataISO: string) => DOW[weekday(dataISO)];

// tipoDia padrão pelo dia-da-semana: domingo → DOMINGO, senão UTIL.
export const tipoDiaPadrao = (dataISO: string): "UTIL" | "DOMINGO" => (weekday(dataISO) === 0 ? "DOMINGO" : "UTIL");

// Todos os dias "YYYY-MM-DD" de um mês "YYYY-MM", em ordem.
export function diasDoMes(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 do mês seguinte = último dia deste
  const out: string[] = [];
  for (let d = 1; d <= total; d++) out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return out;
}

// Lista dos últimos N meses (mais recente primeiro), "YYYY-MM". Base: 2026-05
// (mesma âncora dos outros módulos — dado semeado cai aqui).
export function mesesRecentes(n = 12, base = "2026-05"): string[] {
  const [by, bm] = base.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(by, bm - 1 - i, 1));
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// DASHBOARD ---------------------------------------------------------------
// Espelha DashboardPontoDTO (server/src/services/ponto/dashboard.agg.ts).

export interface DashboardEquipe {
  k: {
    mes: string;
    funcionariosAtivos: number;
    setores: number;
    custoMOMes: number;
    folhaTotalPagar: number;
    valorExtra: number;
    totalHoras: number;
    maiorSetor: { nome: string; total: number; qtd: number } | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export const obterDashboard = (mes: string) => req<DashboardEquipe>(`/ponto/dashboard${qs({ mes })}`);

// Usa a mesma âncora dos outros módulos: mesesRecentes(1)[0] = "2026-05".
export function useDashboard() {
  const mes = useMemo(() => mesesRecentes(1)[0], []);
  const [data, setData] = useState<DashboardEquipe | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    obterDashboard(mes)
      .then((d) => { if (!cancelado) setData(d); })
      .catch(() => { if (!cancelado) setData(null); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [mes]);
  return { data, loading };
}
