import { comPropriedade } from "../propriedadeScope";

export type VisaoAssistente =
  | "resumo"
  | "saldo"
  | "pagar"
  | "receber"
  | "despesas_categoria";
export interface ConfiguracaoAssistente {
  conversaDisponivel: boolean;
  contextoHistorico: string;
  podeEditar?: boolean;
  escopo: { propriedadeId: number | null; nome: string };
  consultas: VisaoAssistente[];
  artigos: { id: string; titulo: string }[];
}
export interface RespostaAssistente {
  locucao?: string;
  proposta?: {
    token: string;
    animal: string;
    data: string;
    pesoKg: number;
    tipo: string;
    origem: string;
    precisao: string;
  };
  modo:
    | "proposta"
    | "dados"
    | "ajuda"
    | "fora_escopo"
    | "esclarecimento"
    | "acesso_negado";
  resposta: string;
  fontes: {
    titulo: string;
    url: string;
    periodo?: { inicio: string; fim: string };
  }[];
  consultadoEm: string;
  escopo: { propriedadeId: number | null; nome: string };
}
export interface RespostaAssistenteVoz extends RespostaAssistente {
  audio: string | null;
  avisoVoz?: string;
}
export async function consultarAssistenteComVoz(
  entrada: Omit<
    Extract<EntradaAssistente, { pergunta: string }>,
    "imagem" | "documento"
  >,
  signal?: AbortSignal,
  sitio?: number | null,
) {
  return ler<RespostaAssistenteVoz>(
    await fetch("/api/assistente/conversar", {
      method: "POST",
      headers: cabecalhos(sitio, { "content-type": "application/json" }),
      body: JSON.stringify(entrada),
      signal,
    }),
  );
}
export type EntradaAssistente =
  | {
      pergunta: string;
      historico: string[];
      pagina: string;
      modo?: "consultar" | "editar";
      documento?: { nome: string; dataUrl: string };
      imagem?: string;
    }
  | { artigoId: string }
  | {
      consulta: {
        visao: VisaoAssistente;
        inicio: string | null;
        fim: string | null;
      };
    };

async function ler<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(
      new Error(
        body.error ??
          "Não foi possível falar com o assistente. Tente novamente.",
      ),
      { status: res.status },
    );
  }
  return res.json() as Promise<T>;
}
export async function obterConfiguracaoAssistente(
  signal?: AbortSignal,
  sitio?: number | null,
) {
  return ler<ConfiguracaoAssistente>(
    await fetch("/api/assistente/configuracao", {
      headers: cabecalhos(sitio),
      signal,
    }),
  );
}
export async function consultarAssistente(
  entrada: EntradaAssistente,
  signal?: AbortSignal,
  sitio?: number | null,
) {
  return ler<RespostaAssistente>(
    await fetch("/api/assistente/consultar", {
      method: "POST",
      headers: cabecalhos(sitio, { "content-type": "application/json" }),
      body: JSON.stringify(entrada),
      signal,
    }),
  );
}
export async function transcreverAudioAssistente(
  audio: Blob,
  signal?: AbortSignal,
  sitio?: number | null,
) {
  const body = new FormData();
  body.append("audio", audio, "pergunta.wav");
  return ler<{ texto: string }>(
    await fetch("/api/assistente/transcrever", {
      method: "POST",
      headers: cabecalhos(sitio),
      body,
      signal,
    }),
  );
}

function cabecalhos(
  sitio?: number | null,
  extras: Record<string, string> = {},
) {
  const headers = comPropriedade(extras);
  if (sitio !== undefined) {
    delete headers["X-Propriedade-Id"];
    if (sitio !== null) headers["X-Propriedade-Id"] = String(sitio);
  }
  return headers;
}
export async function confirmarPesagemAssistente(
  token: string,
  signal: AbortSignal,
  sitio: number | null,
) {
  return ler<RespostaAssistente>(
    await fetch("/api/assistente/confirmar", {
      method: "POST",
      headers: cabecalhos(sitio, { "content-type": "application/json" }),
      body: JSON.stringify({ token, modo: "editar" }),
      signal,
    }),
  );
}
export type MensagemSalva = {
  pergunta: string;
  resposta?: RespostaAssistente;
  erro?: string;
};
export async function listarConversasAssistente(
  signal: AbortSignal,
  sitio: number | null,
) {
  return ler<Array<{ id: string; titulo: string; atualizadoEm: string }>>(
    await fetch("/api/assistente/conversas", {
      headers: cabecalhos(sitio),
      signal,
    }),
  );
}
export async function obterConversaAssistente(
  id: string,
  signal: AbortSignal,
  sitio: number | null,
) {
  return ler<{ mensagens: MensagemSalva[]; revisao: number }>(
    await fetch(`/api/assistente/conversas/${id}`, {
      headers: cabecalhos(sitio),
      signal,
    }),
  );
}
export async function salvarConversaAssistente(
  id: string,
  mensagens: MensagemSalva[],
  signal: AbortSignal,
  sitio: number | null,
  versao: { versaoBase: number; contextoHistorico: string },
) {
  return ler<{ salvo: boolean; revisao: number }>(
    await fetch("/api/assistente/conversas", {
      method: "PUT",
      headers: cabecalhos(sitio, { "content-type": "application/json" }),
      body: JSON.stringify({ id, mensagens, ...versao }),
      signal,
    }),
  );
}

export async function ouvirRespostaAssistente(
  token: string,
  signal: AbortSignal,
  sitio: number | null,
) {
  return ler<{ audio: string }>(
    await fetch("/api/assistente/ouvir", {
      method: "POST",
      headers: cabecalhos(sitio, { "content-type": "application/json" }),
      body: JSON.stringify({ token }),
      signal,
    }),
  );
}
