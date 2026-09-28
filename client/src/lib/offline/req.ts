// Fetch compartilhado por todo módulo (substitui as cópias por módulo de
// `req<T>`). Espera `aguardarFilaLivre()` antes de qualquer chamada — nenhum
// fetch do app roda enquanto a fila de escritas pendentes está sendo
// reprocessada (ver fila.ts).
import { comPropriedade } from "../../propriedadeScope";
import { aguardarFilaLivre } from "./fila";

/** Erro da API: `campo` indica o input ao qual a mensagem se refere. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public campo?: string) {
    super(message);
    this.name = "ApiError";
  }
}

function extrairErro(b: any, status: number): string {
  if (typeof b?.error === "string") return b.error;
  if (typeof b?.erro === "string") return b.erro;
  if (b?.error?.issues?.length) return b.error.issues.map((i: any) => i.message).join("; ");
  return `HTTP ${status}`;
}

async function fetchApi(path: string, init: RequestInit | undefined, headersExtra: Record<string, string>): Promise<Response> {
  await aguardarFilaLivre();
  const headers = comPropriedade({ ...((init?.headers as Record<string, string>) || {}), ...headersExtra });
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new ApiError(extrairErro(corpo, res.status), res.status, corpo?.code, corpo?.campo);
  }
  return res;
}

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi(path, init, init?.body ? { "content-type": "application/json" } : {});
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Variante de `req` pra resposta binária (ex.: PDF de relatório) — mesmo
 *  choke point (fila, escopo, erro), sem tentar `json()` no corpo. */
export async function reqBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetchApi(path, init, {});
  return res.blob();
}
