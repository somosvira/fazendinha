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
  operacaoId: number;
  propriedadeId: number;
  tipo: TipoDocumentoFinanceiro;
  nome: string;
  numero?: string | null;
  mimeType: string;
  buffer: Buffer;
  usuarioId?: number | null;
};

export async function anexarDocumentoOperacao(input: NovoDocumentoOperacao) {
  const operacao = await prisma.operacao.findFirst({ where: { id: input.operacaoId, propriedadeId: input.propriedadeId } });
  if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
  if (!input.buffer.length) throw new FinanceiroError("VALIDACAO", "O arquivo está vazio");
  if (input.buffer.length > MAX_DOCUMENTO_BYTES) throw new FinanceiroError("VALIDACAO", "O arquivo excede o limite de 10 MB");

  const extensaoNome = input.nome.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EXTENSAO_POR_MIME[input.mimeType.toLowerCase()] ? input.mimeType.toLowerCase() : MIME_POR_EXTENSAO[extensaoNome];
  if (!mimeType) throw new FinanceiroError("VALIDACAO", "Formato não suportado. Envie PDF, XML, JPG, PNG ou WEBP");
  const extensao = EXTENSAO_POR_MIME[mimeType];

  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const duplicado = await prisma.documentoFinanceiro.findUnique({ where: { sha256 } });
  if (duplicado) throw new FinanceiroError("CONFLITO", `Este arquivo já está anexado ao documento #${duplicado.id}`);

  const nome = input.nome.trim().slice(0, 180);
  if (!nome) throw new FinanceiroError("VALIDACAO", "Informe o nome do documento");
  const storage = await getStorage();
  const storageKey = `financeiro/operacoes/${input.operacaoId}/${sha256}.${extensao}`;
  const put = await storage.putObject({ key: storageKey, body: input.buffer, contentType: mimeType });

  try {
    const documento = await prisma.documentoFinanceiro.create({ data: {
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

export async function obterDocumento(id: number, propriedadeId: number) {
  const documento = await prisma.documentoFinanceiro.findFirst({
    where: { id, operacao: { propriedadeId } },
  });
  if (!documento?.storageKey) throw new FinanceiroError("NAO_ENCONTRADO", "Documento não encontrado");
  return documento;
}
