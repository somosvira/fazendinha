import crypto from "node:crypto";
import type { TipoDocumentoFinanceiro } from "@prisma/client";
import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { auditar, FinanceiroError } from "./regras.js";

export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

const EXTENSAO_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/xml": "xml",
  "text/xml": "xml",
};
const MIME_POR_EXTENSAO: Record<string, string> = Object.fromEntries(Object.entries(EXTENSAO_POR_MIME).map(([mime, extensao]) => [extensao, mime]));
MIME_POR_EXTENSAO.jpeg = "image/jpeg";

export type NovoDocumentoOperacao = {
  id?: string;
  operacaoId: string;
  propriedadeId: number;
  tipo: TipoDocumentoFinanceiro;
  nome: string;
  numero?: string | null;
  mimeType: string;
  buffer: Buffer;
  usuarioId?: number | null;
};

export type NovoDocumentoRascunho = Omit<NovoDocumentoOperacao, "operacaoId"> & {
  rascunhoId: string;
};

function validarArquivo(input: { nome: string; mimeType: string; buffer: Buffer }) {
  if (!input.buffer.length) throw new FinanceiroError("VALIDACAO", "O arquivo está vazio");
  if (input.buffer.length > MAX_DOCUMENTO_BYTES) throw new FinanceiroError("VALIDACAO", "O arquivo excede o limite de 10 MB");
  const extensaoNome = input.nome.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EXTENSAO_POR_MIME[input.mimeType.toLowerCase()] ? input.mimeType.toLowerCase() : MIME_POR_EXTENSAO[extensaoNome];
  if (!mimeType) throw new FinanceiroError("VALIDACAO", "Formato não suportado. Envie PDF, XML, JPG, PNG ou WEBP");
  const nome = input.nome.trim().slice(0, 180);
  if (!nome) throw new FinanceiroError("VALIDACAO", "Informe o nome do documento");
  return { nome, mimeType, extensao: EXTENSAO_POR_MIME[mimeType], sha256: crypto.createHash("sha256").update(input.buffer).digest("hex") };
}

export async function anexarDocumentoOperacao(input: NovoDocumentoOperacao) {
  const operacao = await prisma.operacao.findFirst({ where: { id: input.operacaoId, propriedadeId: input.propriedadeId } });
  if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
  const { nome, mimeType, extensao, sha256 } = validarArquivo(input);
  const duplicado = await prisma.documentoFinanceiro.findUnique({ where: { sha256 } });
  if (duplicado) throw new FinanceiroError("CONFLITO", "Este arquivo já está anexado");

  const storage = await getStorage();
  const storageKey = `financeiro/operacoes/${input.operacaoId}/${sha256}.${extensao}`;
  const put = await storage.putObject({ key: storageKey, body: input.buffer, contentType: mimeType });

  try {
    const documento = await prisma.documentoFinanceiro.create({ data: {
      id: input.id,
      tipo: input.tipo,
      nome,
      numero: input.numero?.trim().slice(0, 80) || null,
      storageDriver: put.storageDriver,
      bucket: put.bucket,
      storageKey: put.storageKey,
      mimeType,
      tamanhoBytes: input.buffer.length,
      sha256,
      operacaoId: input.operacaoId,
    } });
    await auditar(prisma, { entidade: "DocumentoFinanceiro", entidadeId: documento.id, acao: "ANEXADO", usuarioId: input.usuarioId, depois: documento });
    return documento;
  } catch (erro) {
    await storage.deleteObject({ key: storageKey });
    throw erro;
  }
}

export async function anexarDocumentoRascunho(input: NovoDocumentoRascunho) {
  const rascunho = await prisma.rascunhoOperacao.findFirst({
    where: { id: input.rascunhoId, propriedadeId: input.propriedadeId, criadoPorId: input.usuarioId ?? -1 },
  });
  if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
  const { nome, mimeType, extensao, sha256 } = validarArquivo(input);
  const duplicado = await prisma.documentoFinanceiro.findUnique({ where: { sha256 } });
  if (duplicado) throw new FinanceiroError("CONFLITO", "Este arquivo já está anexado");
  const storage = await getStorage();
  const storageKey = `financeiro/rascunhos/${input.rascunhoId}/${sha256}.${extensao}`;
  const put = await storage.putObject({ key: storageKey, body: input.buffer, contentType: mimeType });
  try {
    return await prisma.documentoFinanceiro.create({ data: {
      id: input.id,
      tipo: input.tipo, nome, numero: input.numero?.trim().slice(0, 80) || null,
      storageDriver: put.storageDriver, bucket: put.bucket, storageKey: put.storageKey,
      mimeType, tamanhoBytes: input.buffer.length, sha256, rascunhoId: input.rascunhoId,
    } });
  } catch (erro) {
    await storage.deleteObject({ key: storageKey });
    throw erro;
  }
}

export async function removerDocumentoRascunho(id: string, rascunhoId: string, propriedadeId: number, usuarioId: number) {
  const documento = await prisma.documentoFinanceiro.findFirst({
    where: { id, rascunhoId, rascunho: { propriedadeId, criadoPorId: usuarioId } },
  });
  if (!documento) throw new FinanceiroError("NAO_ENCONTRADO", "Documento do rascunho não encontrado");
  await prisma.documentoFinanceiro.delete({ where: { id } });
  if (documento.storageKey) await (await getStorage()).deleteObject({ key: documento.storageKey });
}

export async function atualizarDocumentoRascunho(id: string, rascunhoId: string, propriedadeId: number, usuarioId: number, input: { tipo?: TipoDocumentoFinanceiro; numero?: string | null }) {
  const documento = await prisma.documentoFinanceiro.findFirst({
    where: { id, rascunhoId, rascunho: { propriedadeId, criadoPorId: usuarioId } },
  });
  if (!documento) throw new FinanceiroError("NAO_ENCONTRADO", "Documento do rascunho não encontrado");
  return prisma.documentoFinanceiro.update({ where: { id }, data: {
    tipo: input.tipo, numero: input.numero?.trim().slice(0, 80) || null,
  } });
}

export async function obterDocumento(id: string, propriedadeId: number) {
  const documento = await prisma.documentoFinanceiro.findFirst({
    where: { id, operacao: { propriedadeId } },
  });
  if (!documento?.storageKey) throw new FinanceiroError("NAO_ENCONTRADO", "Documento não encontrado");
  return documento;
}
