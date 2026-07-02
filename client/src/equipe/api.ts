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

import { useEffect, useState, useCallback } from "react";
import type { FuncionarioDTO, RegistroDTO, FolhaDTO } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } } : init);
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
  salarioMensal: number;
  cargaMensalHoras: number;
  jornadaDiariaHoras: number;
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

export const listarFuncionarios = (ativo?: boolean) =>
  req<FuncionarioDTO[]>(`/ponto/funcionarios${qs({ ativo })}`);
export const obterFuncionario = (id: string) => req<FuncionarioDTO>(`/ponto/funcionarios/${id}`);
export const criarFuncionario = (input: FuncionarioInput) =>
  req<FuncionarioDTO>(`/ponto/funcionarios`, { method: "POST", body: JSON.stringify(input) });
export const editarFuncionario = (id: string, input: Partial<FuncionarioInput>) =>
  req<FuncionarioDTO>(`/ponto/funcionarios/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const baixarFuncionario = (id: string) =>
  req<FuncionarioDTO>(`/ponto/funcionarios/${id}/baixa`, { method: "POST" });

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

export function useRegistros(funcionarioId: string | null, mes: string) {
  const [data, setData] = useState<RegistroDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!funcionarioId) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarRegistros(funcionarioId, mes).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [funcionarioId, mes]);
  useEffect(() => {
    if (!funcionarioId) { setData([]); setLoading(false); return; }
    let cancelado = false;
    setLoading(true); setErro(null);
    listarRegistros(funcionarioId, mes)
      .then((d) => { if (!cancelado) setData(d); })
      .catch((e) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [funcionarioId, mes]);
  return { data, loading, erro, recarregar };
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

// FORMATADORES (pt-BR) ----------------------------------------------------

export const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
