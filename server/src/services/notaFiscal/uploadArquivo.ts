// Service compartilhado de upload de nota fiscal. Antes esta lógica estava inline
// na rota POST /api/lancamentos/:id/nota-fiscal; com o bot WhatsApp ela precisa ser
// reusável em dois caminhos:
//
//   1. HTTP (frontend): Lancamento já existe -> upload + criar NotaFiscalArquivo +
//      enfileirar OCR.
//   2. WhatsApp: foto chega antes do Lancamento. Fase 1 valida + persiste no storage
//      sem criar registro; fase 2 (após "Confirmar") cria o Lancamento e amarra o
//      arquivo já persistido a ele.

import type { NotaFiscalArquivo } from "@prisma/client";
import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { validarUploadSincrono } from "./validacaoSincrona.js";
import { agendarValidacaoAssincrona } from "./validacaoAssincrona.js";

export type MimeTypeReal = "application/pdf" | "image/jpeg" | "image/png";

export type MetadadosArquivoPersistido = {
  storageDriver: string;
  bucket: string | null;
  storageKey: string;
  sha256: string;
  mimeTypeReal: MimeTypeReal;
  ext: string;
  tamanhoBytes: number;
};

export type DuplicataExistente = { id: number; lancamentoId: number };

export type ResultadoPersistir =
  | { ok: true; metadados: MetadadosArquivoPersistido }
  | {
      ok: false;
      codigo: "VALIDACAO" | "DUPLICATA";
      mensagem: string;
      httpStatus: 400 | 409;
      duplicata?: DuplicataExistente;
    };

export type ResultadoUploadHttp =
  | { ok: true; arquivo: NotaFiscalArquivo }
  | {
      ok: false;
      codigo: "LANCAMENTO_INVALIDO" | "VALIDACAO" | "DUPLICATA";
      mensagem: string;
      httpStatus: 400 | 404 | 409;
      duplicata?: DuplicataExistente;
    };

// ─── Helpers internos ─────────────────────────────────────────────────────

async function buscarDuplicataPorSha256(sha256: string): Promise<DuplicataExistente | null> {
  const dup = await prisma.notaFiscalArquivo.findUnique({ where: { sha256 } });
  return dup ? { id: dup.id, lancamentoId: dup.lancamentoId } : null;
}

// ─── Fluxo HTTP (Lancamento já existe) ────────────────────────────────────

export async function uploadArquivoNotaFiscalHttp(args: {
  lancamentoId: number;
  buffer: Buffer;
  mimeTypeDeclarado: string;
}): Promise<ResultadoUploadHttp> {
  const { lancamentoId, buffer, mimeTypeDeclarado } = args;

  const lancamento = await prisma.lancamento.findUnique({ where: { id: lancamentoId } });
  if (!lancamento) {
    return { ok: false, codigo: "LANCAMENTO_INVALIDO", mensagem: "lançamento não encontrado", httpStatus: 404 };
  }

  const validacao = await validarUploadSincrono({ buffer, mimeTypeDeclarado });
  if (!validacao.ok) {
    return { ok: false, codigo: "VALIDACAO", mensagem: validacao.mensagem, httpStatus: 400 };
  }
  const { sha256, mimeTypeReal, ext } = validacao;

  const duplicata = await buscarDuplicataPorSha256(sha256);
  if (duplicata) {
    return {
      ok: false,
      codigo: "DUPLICATA",
      mensagem: "este arquivo já foi enviado antes (mesmo hash)",
      httpStatus: 409,
      duplicata,
    };
  }

  const storage = await getStorage();
  const storageKey = `notas/${lancamentoId}/${sha256}.${ext}`;
  const put = await storage.putObject({ key: storageKey, body: buffer, contentType: mimeTypeReal });

  const arquivo = await prisma.notaFiscalArquivo.create({
    data: {
      lancamentoId,
      storageDriver: put.storageDriver,
      bucket: put.bucket,
      storageKey: put.storageKey,
      mimeType: mimeTypeReal,
      tamanhoBytes: buffer.length,
      sha256,
      statusValidacao: "PENDENTE",
    },
  });

  agendarValidacaoAssincrona(arquivo.id);

  return { ok: true, arquivo };
}

// ─── Fluxo WhatsApp fase 1: persistir antes de existir Lancamento ─────────

// Valida o arquivo, dedupa contra NotaFiscalArquivo e sobe pro storage usando
// um keyPrefix customizado (ex.: "notas/_wa"). Não cria registro Prisma — isso
// fica para a fase 2 (após o usuário confirmar no WhatsApp).
export async function persistirArquivoParaConfirmacao(args: {
  buffer: Buffer;
  mimeTypeDeclarado: string;
  keyPrefix: string;
}): Promise<ResultadoPersistir> {
  const { buffer, mimeTypeDeclarado, keyPrefix } = args;

  const validacao = await validarUploadSincrono({ buffer, mimeTypeDeclarado });
  if (!validacao.ok) {
    return { ok: false, codigo: "VALIDACAO", mensagem: validacao.mensagem, httpStatus: 400 };
  }
  const { sha256, mimeTypeReal, ext } = validacao;

  const duplicata = await buscarDuplicataPorSha256(sha256);
  if (duplicata) {
    return {
      ok: false,
      codigo: "DUPLICATA",
      mensagem: "este arquivo já foi enviado antes",
      httpStatus: 409,
      duplicata,
    };
  }

  const storage = await getStorage();
  const storageKey = `${keyPrefix.replace(/\/$/, "")}/${sha256}.${ext}`;
  const put = await storage.putObject({ key: storageKey, body: buffer, contentType: mimeTypeReal });

  return {
    ok: true,
    metadados: {
      storageDriver: put.storageDriver,
      bucket: put.bucket,
      storageKey: put.storageKey,
      sha256,
      mimeTypeReal,
      ext,
      tamanhoBytes: buffer.length,
    },
  };
}

// ─── Fluxo WhatsApp fase 2: vincular arquivo já persistido ao Lancamento ──

// Cria o registro NotaFiscalArquivo apontando para um objeto já no storage
// (key permanece a do upload original — "notas/_wa/<sha>.<ext>"; não copia).
export async function registrarArquivoJaPersistido(args: {
  lancamentoId: number;
  metadados: MetadadosArquivoPersistido;
}): Promise<NotaFiscalArquivo> {
  const { lancamentoId, metadados } = args;
  const arquivo = await prisma.notaFiscalArquivo.create({
    data: {
      lancamentoId,
      storageDriver: metadados.storageDriver,
      bucket: metadados.bucket,
      storageKey: metadados.storageKey,
      mimeType: metadados.mimeTypeReal,
      tamanhoBytes: metadados.tamanhoBytes,
      sha256: metadados.sha256,
      statusValidacao: "PENDENTE",
    },
  });
  agendarValidacaoAssincrona(arquivo.id);
  return arquivo;
}
