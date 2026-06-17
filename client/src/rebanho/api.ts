import { useEffect, useState, useCallback } from "react";
import type { Animal, ResumoAnimal, EventoTimeline } from "./types";

export interface RacaDTO { id: number; nome: string }
export interface GrupoDTO { id: number; nome: string }
export interface AnimalForm {
  numero: string; nome?: string; sexo: "F" | "M"; categoria: Animal["categoria"];
  racaId?: number; grauSangue?: string; dataNascimento?: string; dataEntrada: string;
  brincoEletronico?: string; sisbov?: string; maeId?: number; paiNome?: string; grupoId?: number; setor?: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } } : init);
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: número duplicado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  return res.json();
}

export const listarAnimais = (f?: { status?: string; grupoId?: number; q?: string }) => {
  const p = new URLSearchParams();
  if (f?.status) p.set("status", f.status);
  if (f?.grupoId) p.set("grupoId", String(f.grupoId));
  if (f?.q) p.set("q", f.q);
  const qs = p.toString();
  return req<Animal[]>(`/rebanho/animais${qs ? `?${qs}` : ""}`);
};
export const obterAnimal = (id: string) => req<Animal>(`/rebanho/animais/${id}`);
export const criarAnimal = (input: AnimalForm) => req<Animal>(`/rebanho/animais`, { method: "POST", body: JSON.stringify(input) });
export const editarAnimal = (id: string, input: Partial<AnimalForm>) => req<Animal>(`/rebanho/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: { motivo: string; data?: string }) => req<Animal>(`/rebanho/animais/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });
export const listarGrupos = () => req<GrupoDTO[]>(`/rebanho/grupos`);
export const listarRacas = () => req<RacaDTO[]>(`/rebanho/racas`);

export function useAnimais(f?: { status?: string; grupoId?: number; q?: string }) {
  const [data, setData] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarAnimais(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface EventoPayload {
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM";
  data: string; observacao?: string;
  reprodutor?: string; protocolo?: string;
  resultado?: "positivo" | "negativo"; dtPartoPrevista?: string;
  numCrias?: number; sexoCria?: string; tipoParto?: string; motivoSecagem?: string;
}
export const listarEventos = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/eventos`);
export const registrarEvento = (id: string, p: EventoPayload) => req<EventoTimeline>(`/rebanho/animais/${id}/eventos`, { method: "POST", body: JSON.stringify(p) });
export const excluirEvento = (eventoId: string) => req<{ ok: true }>(`/rebanho/eventos/${eventoId}`, { method: "DELETE" });

export function useEventos(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarEventos(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface EventoSanidadePayload {
  tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA";
  data: string; observacao?: string;
  doenca?: string; diasTratamento?: number;
  produto?: string; dose?: string; carencia?: number; loteProduto?: string;
  ccs?: number; gordura?: number; proteina?: number;
  quarto?: string; severidade?: string; resultadoCultivo?: string;
}
export const montarTimeline = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/timeline`);
export const registrarEventoSanidade = (id: string, p: EventoSanidadePayload) => req<EventoTimeline>(`/rebanho/animais/${id}/sanidade`, { method: "POST", body: JSON.stringify(p) });

export function useTimeline(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    montarTimeline(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useAnimal(id: string | null) {
  const [data, setData] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterAnimal(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export type { ResumoAnimal };
