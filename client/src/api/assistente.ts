import { comPropriedade } from "../propriedadeScope";

export type VisaoAssistente = "resumo" | "saldo" | "pagar" | "receber" | "despesas_categoria";
export interface ConfiguracaoAssistente {
  conversaDisponivel: boolean;
  escopo: { propriedadeId: number | null; nome: string };
  consultas: VisaoAssistente[];
  artigos: { id: string; titulo: string }[];
}
export interface RespostaAssistente {
  modo: "dados" | "ajuda" | "fora_escopo" | "esclarecimento" | "acesso_negado";
  resposta: string;
  fontes: { titulo: string; url: string; periodo?: { inicio: string; fim: string } }[];
  consultadoEm: string;
  escopo: { propriedadeId: number | null; nome: string };
}
export type EntradaAssistente = { pergunta: string; historico: string[]; pagina: string; imagem?: string }
  | { artigoId: string }
  | { consulta: { visao: VisaoAssistente; inicio: string | null; fim: string | null } };

async function ler<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Não foi possível falar com o assistente. Tente novamente.");
  }
  return res.json() as Promise<T>;
}
export async function obterConfiguracaoAssistente(signal?: AbortSignal) {
  return ler<ConfiguracaoAssistente>(await fetch("/api/assistente/configuracao", { headers: comPropriedade(), signal }));
}
export async function consultarAssistente(entrada: EntradaAssistente, signal?: AbortSignal) {
  return ler<RespostaAssistente>(await fetch("/api/assistente/consultar", { method: "POST", headers: comPropriedade({ "content-type": "application/json" }), body: JSON.stringify(entrada), signal }));
}
export async function transcreverAudioAssistente(audio: Blob, signal?: AbortSignal) {
  const body = new FormData(); body.append("audio", audio, "pergunta.wav");
  return ler<{ texto: string }>(await fetch("/api/assistente/transcrever", { method: "POST", headers: comPropriedade(), body, signal }));
}
