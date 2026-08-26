// Fetch compartilhado por todo módulo (substitui as cópias por módulo de
// `req<T>`). Espera `aguardarFilaLivre()` antes de qualquer chamada — nenhum
// fetch do app roda enquanto a fila de escritas pendentes está sendo
// reprocessada (ver fila.ts).
import { comPropriedade } from "../../propriedadeScope";
import { aguardarFilaLivre } from "./fila";

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
  if (!res.ok) throw new Error(extrairErro(await res.json().catch(() => null), res.status));
  if (res.status === 204) return undefined as T;
  return res.json();
}
