// Pipeline síncrono — roda ANTES do PUT no storage. Rejeita lixo óbvio sem custo
// (sem OCR, sem chamada externa). Objetivo: confiar nos magic bytes em vez do MIME
// que o browser declarou e barrar arquivos minúsculos / fora de tamanho / com
// dimensões pequenas demais para um humano ler.

import crypto from "node:crypto";
import { createRequire } from "node:module";
import sharp from "sharp";

// pdf-parse é CommonJS sem default export ESM-compatível; uso createRequire pra
// importar sem disparar o bug do test.pdf no boot do submódulo.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

const MIN_BYTES = 50 * 1024; // 50KB
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MIN_IMG_DIM = 600; // pixels — foto desfocada/cortada não passa

type MimeReal = "application/pdf" | "image/jpeg" | "image/png";

const MAGIC: Array<{ mime: MimeReal; ext: string; magic: Buffer }> = [
  { mime: "application/pdf", ext: "pdf", magic: Buffer.from("%PDF-") },
  { mime: "image/jpeg", ext: "jpg", magic: Buffer.from([0xff, 0xd8, 0xff]) },
  { mime: "image/png", ext: "png", magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
];

export type ValidacaoSincronaOk = {
  ok: true;
  mimeTypeReal: MimeReal;
  ext: string;
  sha256: string;
};

export type ValidacaoSincronaErro = {
  ok: false;
  codigo:
    | "TAMANHO_PEQUENO"
    | "TAMANHO_GRANDE"
    | "TIPO_INVALIDO"
    | "TIPO_INCONSISTENTE"
    | "PDF_CORROMPIDO"
    | "IMG_CORROMPIDA"
    | "IMG_PEQUENA";
  mensagem: string;
};

export async function validarUploadSincrono(args: {
  buffer: Buffer;
  mimeTypeDeclarado: string;
}): Promise<ValidacaoSincronaOk | ValidacaoSincronaErro> {
  const { buffer, mimeTypeDeclarado } = args;

  if (buffer.length < MIN_BYTES) {
    return {
      ok: false,
      codigo: "TAMANHO_PEQUENO",
      mensagem: `Arquivo muito pequeno (${(buffer.length / 1024).toFixed(0)}KB). Mínimo ${MIN_BYTES / 1024}KB.`,
    };
  }
  if (buffer.length > MAX_BYTES) {
    return {
      ok: false,
      codigo: "TAMANHO_GRANDE",
      mensagem: `Arquivo muito grande (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Máximo ${MAX_BYTES / 1024 / 1024}MB.`,
    };
  }

  // Magic bytes — não confiar no MIME declarado pelo browser
  const detectado = MAGIC.find((m) => buffer.subarray(0, m.magic.length).equals(m.magic));
  if (!detectado) {
    return {
      ok: false,
      codigo: "TIPO_INVALIDO",
      mensagem: "Arquivo não é PDF, JPG nem PNG (assinatura binária não reconhecida).",
    };
  }
  const mimeDeclaradoNorm = mimeTypeDeclarado.toLowerCase().replace("image/jpg", "image/jpeg");
  if (mimeDeclaradoNorm !== detectado.mime) {
    return {
      ok: false,
      codigo: "TIPO_INCONSISTENTE",
      mensagem: `Tipo declarado (${mimeTypeDeclarado}) não bate com o conteúdo (${detectado.mime}).`,
    };
  }

  // Conteúdo
  if (detectado.mime === "application/pdf") {
    try {
      await pdfParse(buffer);
    } catch {
      return { ok: false, codigo: "PDF_CORROMPIDO", mensagem: "PDF corrompido ou inválido." };
    }
  } else {
    try {
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) {
        return { ok: false, codigo: "IMG_CORROMPIDA", mensagem: "Imagem sem dimensões legíveis." };
      }
      if (meta.width < MIN_IMG_DIM || meta.height < MIN_IMG_DIM) {
        return {
          ok: false,
          codigo: "IMG_PEQUENA",
          mensagem: `Foto pequena demais (${meta.width}×${meta.height}). Mínimo ${MIN_IMG_DIM}×${MIN_IMG_DIM}.`,
        };
      }
    } catch {
      return { ok: false, codigo: "IMG_CORROMPIDA", mensagem: "Imagem corrompida ou formato não suportado." };
    }
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { ok: true, mimeTypeReal: detectado.mime, ext: detectado.ext, sha256 };
}
