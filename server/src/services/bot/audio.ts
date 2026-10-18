import { env } from "../../env.js";
import { criarClienteOpenAI } from "./openai.js";
import { ConsultaAssistenteError } from "./consulta.schema.js";

export const LIMITE_AUDIO = 10 * 1024 * 1024;
const FORMATOS = new Set(["audio/webm", "video/webm", "audio/mp4", "video/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/x-m4a", "audio/m4a"]);

export function validarAudio(arquivo: File) {
  if (!arquivo.size || arquivo.size > LIMITE_AUDIO) throw new ConsultaAssistenteError("Envie um áudio com até 10 MB.");
  if (!FORMATOS.has(arquivo.type.split(";")[0].toLowerCase())) throw new ConsultaAssistenteError("Use um áudio MP3, MP4, M4A, WAV, OGG ou WebM.");
}

export async function transcreverAudio(arquivo: File): Promise<string> {
  validarAudio(arquivo);
  const resposta = await criarClienteOpenAI().audio.transcriptions.create({
    file: arquivo, model: env.OPENAI_TRANSCRIPTION_MODEL, language: "pt", response_format: "json",
  });
  const texto = resposta.text.trim();
  if (!texto) throw new ConsultaAssistenteError("Não consegui ouvir a pergunta. Grave novamente ou digite.");
  if (texto.length > 2000) throw new ConsultaAssistenteError("O áudio ficou longo. Grave uma pergunta mais curta.");
  return texto;
}
