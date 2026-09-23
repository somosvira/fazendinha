// Cadastro de propriedades (sítios) — compartilhado por todos os módulos.
// Fala com /api/propriedades; o envelope padrão (auth + sítio ativo) vem de comPropriedade().
import { useCallback, useEffect, useState } from "react";
import { comPropriedade } from "../propriedadeScope";

export interface PropriedadeDTO { id: number; nome: string; apelido: string | null; cidade: string | null; uf: string | null; principal: boolean; ativo: boolean; ordem: number; }
export interface PropriedadeInput { nome: string; apelido?: string; cidade?: string; uf?: string; principal?: boolean; ativo?: boolean; ordem?: number; }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) || {}) };
  if (init?.body) headers["content-type"] = "application/json";
  const res = await fetch(`/api${path}`, { ...init, headers: comPropriedade(headers) });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; ");
    throw new Error(msg);
  }
  return res.json();
}

export const listarPropriedades = (opts?: { incluirInativos?: boolean }) =>
  req<PropriedadeDTO[]>(`/propriedades${opts?.incluirInativos ? "?incluirInativos=true" : ""}`);
export const criarPropriedade = (p: PropriedadeInput) => req<PropriedadeDTO>(`/propriedades`, { method: "POST", body: JSON.stringify(p) });
export const editarPropriedade = (id: number, p: PropriedadeInput) => req<PropriedadeDTO>(`/propriedades/${id}`, { method: "PATCH", body: JSON.stringify(p) });

/** `incluirInativos`: usado pela tela de Cadastros > Sítios, que precisa listar e
 *  reativar sítios desativados. O seletor global (FarmPicker) chama sem opções e
 *  continua vendo só os ativos. */
export function usePropriedades(opts?: { incluirInativos?: boolean }) {
  const incluirInativos = opts?.incluirInativos ?? false;
  const [data, setData] = useState<PropriedadeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarPropriedades({ incluirInativos }).then(setData).catch(() => setData([])).finally(() => setLoading(false)); }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}
