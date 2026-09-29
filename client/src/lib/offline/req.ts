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

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  await aguardarFilaLivre();
  const headers = comPropriedade({
    ...((init?.headers as Record<string, string>) || {}),
    ...(init?.body ? { "content-type": "application/json" } : {}),
  });
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new ApiError(extrairErro(corpo, res.status), res.status, corpo?.code, corpo?.campo);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
