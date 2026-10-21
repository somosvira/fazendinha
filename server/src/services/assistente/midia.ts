import OpenAI, { toFile } from "openai";
import { env } from "../../env.js";
import { AssistenteError } from "./tipos.js";

export const MAX_IMAGEM_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGEM_BASE64 = Math.ceil(MAX_IMAGEM_BYTES / 3) * 4 + 40;
export const MAX_AUDIO_BYTES = 44 + 16_000 * 2 * 60;
const invalido = (mensagem: string): never => { throw new AssistenteError("VALIDACAO", mensagem); };

/** Aceita somente bytes inline; não busca URLs nem aceita SVG/HTML. */
export function validarImagem(dataUrl: string): string {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || dataUrl.length > MAX_IMAGEM_BASE64) return invalido("Envie um print PNG, JPG ou WebP de até 2 MB.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGEM_BYTES || bytes.toString("base64") !== match[2]) return invalido("Print inválido ou maior que 2 MB.");
  const formato = match[1];
  let largura = 0; let altura = 0;
  if (formato === "png" && bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR") {
    largura = bytes.readUInt32BE(16); altura = bytes.readUInt32BE(20);
  } else if (formato === "jpeg" && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break;
      const marcador = bytes[offset + 1];
      if (marcador === 255) { offset++; continue; }
      if (marcador === 217 || marcador === 218) break;
      const tamanho = bytes.readUInt16BE(offset + 2);
      if (tamanho < 2 || offset + tamanho + 2 > bytes.length) break;
      if ([192, 193, 194].includes(marcador) && tamanho >= 8) { altura = bytes.readUInt16BE(offset + 5); largura = bytes.readUInt16BE(offset + 7); break; }
      offset += tamanho + 2;
    }
  } else if (formato === "webp" && bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const tipo = bytes.toString("ascii", 12, 16);
    if (tipo === "VP8X" && !(bytes[20] & 2)) { largura = 1 + bytes.readUIntLE(24, 3); altura = 1 + bytes.readUIntLE(27, 3); }
    if (tipo === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) { largura = bytes.readUInt16LE(26) & 0x3fff; altura = bytes.readUInt16LE(28) & 0x3fff; }
    if (tipo === "VP8L" && bytes[20] === 47) { const bits = bytes.readUInt32LE(21); largura = (bits & 0x3fff) + 1; altura = ((bits >>> 14) & 0x3fff) + 1; }
  }
  if (!largura || !altura || largura > 1600 || altura > 1600) return invalido("Print inválido. Use uma imagem de até 1600 × 1600 pixels.");
  return dataUrl;
}

/** WAV canônico do cliente: PCM mono/16-bit/16 kHz. Verifica duração pelos
 * bytes, não por um campo enviado pelo navegador; limita cobrança e memória. */
export function validarAudio(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length < 44 || b.length > MAX_AUDIO_BYTES) return invalido("Envie um áudio de até 60 segundos.");
  const valido = b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE"
    && b.readUInt32LE(4) === b.length - 8 && b.toString("ascii", 12, 16) === "fmt " && b.readUInt32LE(16) === 16
    && b.readUInt16LE(20) === 1 && b.readUInt16LE(22) === 1 && b.readUInt32LE(24) === 16000 && b.readUInt32LE(28) === 32000
    && b.readUInt16LE(32) === 2 && b.readUInt16LE(34) === 16 && b.toString("ascii", 36, 40) === "data"
    && b.readUInt32LE(40) === b.length - 44 && (b.length - 44) % 2 === 0;
  const duracao = (b.length - 44) / 32000;
  if (!valido || duracao < 0.1 || duracao > 60) return invalido("Áudio inválido. Grave novamente ou escolha outro arquivo de até 60 segundos.");
  return duracao;
}
export async function transcreverAudio(bytes: Uint8Array) {
  validarAudio(bytes);
  if (!env.OPENAI_API_KEY?.trim()) throw new AssistenteError("NAO_CONFIGURADO", "A transcrição ainda não foi configurada.");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 20_000 });
  try {
    const r = await client.audio.transcriptions.create({ model: env.OPENAI_TRANSCRIBE_MODEL, file: await toFile(bytes, "pergunta.wav", { type: "audio/wav" }), language: "pt", response_format: "json" });
    const texto = r.text.trim();
    if (!texto || texto.length > 2000) throw new AssistenteError("VALIDACAO", "Não consegui obter uma pergunta de até 2.000 caracteres. Tente um áudio mais curto.");
    return texto;
  } catch (e) {
    if (e instanceof AssistenteError) throw e;
    throw new AssistenteError("INDISPONIVEL", "Não foi possível transcrever o áudio. Tente novamente ou digite sua pergunta.");
  }
}
