import { del, get, set } from "idb-keyval";
import { getUsuario } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";

/** Rascunho de operação editado sem conexão, ainda não enviado ao servidor.
 *  `versao` é a do rascunho do servidor quando a edição começou: é com ela que
 *  o conteúdo sobe ao reconectar, para o servidor recusar se outro aparelho
 *  mexeu no rascunho nesse meio-tempo. */
export type RascunhoLocal = {
  dados: { formulario: Record<string, unknown>; operacao: Record<string, unknown> };
  versao?: number;
  salvoEm: string;
};

const chave = () => `rionovo-rascunho-operacao:${getUsuario()?.id ?? "anonimo"}:${getPropriedadeAtiva() ?? "todas"}`;

export async function lerRascunhoLocal(): Promise<RascunhoLocal | null> {
  try { return (await get<RascunhoLocal>(chave())) ?? null; } catch { return null; }
}

export async function salvarRascunhoLocal(rascunho: Omit<RascunhoLocal, "salvoEm">): Promise<void> {
  try { await set(chave(), { ...rascunho, salvoEm: new Date().toISOString() }); } catch { /* sem IndexedDB o formulário segue só em memória */ }
}

export async function limparRascunhoLocal(): Promise<void> {
  try { await del(chave()); } catch { /* nada a limpar */ }
}
