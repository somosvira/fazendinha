import { comPropriedade } from "../propriedadeScope";

export interface ConsultaAssistente {
  assunto: "resumo" | "saidas" | "entradas" | "categorias" | "pagar" | "receber" | "saldos" | "fora_escopo";
  inicio: string | null;
  fim: string | null;
  compararInicio: string | null;
  compararFim: string | null;
  categoria: string | null;
}
export interface ContextoAssistente { propriedadeId: number | null; consulta: ConsultaAssistente }
export interface RespostaAssistente {
  resposta: string;
  fontes: { titulo: string; url: string }[];
  contexto: ContextoAssistente | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/bot/${path}`, init);
  const dados = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(dados.error ?? "Não foi possível falar com o assistente. Tente novamente.");
  return dados as T;
}
export const statusAssistente = (signal: AbortSignal) => request<{ configurado: boolean }>("status", { headers: comPropriedade(), signal });
export const consultarAssistente = (pergunta: string, contexto: ContextoAssistente | null, signal: AbortSignal) => request<RespostaAssistente>("ask", {
  method: "POST", headers: comPropriedade({ "content-type": "application/json" }), body: JSON.stringify({ pergunta, contexto }), signal,
});
export function transcreverAudio(arquivo: File, signal: AbortSignal) {
  const body = new FormData(); body.set("audio", arquivo);
  return request<{ texto: string }>("transcrever", { method: "POST", headers: comPropriedade(), body, signal });
}
