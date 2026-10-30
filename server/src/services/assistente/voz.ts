import OpenAI from "openai";
import { env } from "../../env.js";
import { AssistenteError } from "./tipos.js";

/** Recebe somente a resposta já autorizada pelo servidor, nunca texto livre para locução. */
export async function sintetizarResposta(texto: string): Promise<string> {
  if (!env.OPENAI_API_KEY?.trim()) throw new AssistenteError("NAO_CONFIGURADO", "A voz do assistente ainda não foi configurada.");
  if (!texto.trim() || texto.length > 4000) throw new AssistenteError("VALIDACAO", "Esta resposta está disponível somente por escrito.");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 0 });
  const controller = new AbortController();
  let leitor: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      void leitor?.cancel().catch(() => {});
      reject(new Error("Prazo da síntese excedido"));
    }, 20_000);
  });
  async function gerar() {
    const resposta = await client.audio.speech.create({
      model: env.OPENAI_SPEECH_MODEL, voice: "coral", input: texto, response_format: "mp3",
      instructions: "Leia fielmente o texto em português brasileiro, com clareza e ritmo natural. Não acrescente nem altere informações. A voz é de um assistente virtual.",
    }, { signal: controller.signal });
    const tamanho = Number(resposta.headers.get("content-length"));
    if (tamanho > 4 * 1024 * 1024) throw new Error("Áudio excessivo");
    // Limite durante a leitura, inclusive quando o provedor não envia content-length.
    leitor = resposta.body?.getReader();
    if (!leitor) throw new Error("Áudio ausente");
    const partes: Uint8Array[] = []; let total = 0;
    try {
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        total += value.byteLength;
        if (total > 4 * 1024 * 1024) { await leitor.cancel(); throw new Error("Áudio excessivo"); }
        partes.push(value);
      }
    } finally { leitor.releaseLock(); }
    if (!total) throw new Error("Áudio vazio");
    return `data:audio/mpeg;base64,${Buffer.concat(partes).toString("base64")}`;
  }
  try { return await Promise.race([gerar(), prazo]); }
  catch {
    throw new AssistenteError("INDISPONIVEL", "Não foi possível gerar a voz. Confira a resposta escrita.");
  } finally { clearTimeout(timer); }
}
