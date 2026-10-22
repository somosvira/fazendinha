import crypto from "node:crypto";
import { prisma } from "../../../db.js";
import { env } from "../../../env.js";
import { getStorage } from "../../../lib/storage.js";
import { criarUploadDireto, lerIntentUpload, promoverUploadDireto, removerUploadPromovido, removerUploadTemporario, UploadInvalidoError } from "../../../lib/uploads.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { obterEntregaLeiteTx } from "./comercial.js";
import { solicitarLaudoQualidadeSchema, type SolicitarLaudoQualidadeInput } from "./qualidade.schemas.js";
import type { ComprovanteEntregaLeite } from "@prisma/client";


type DadosLaudo = { contexto: "ENTREGA_LEITE"; entregaId: string; propriedadeId: number; usuarioId: number | null; comprovanteId: string; nome: string; extensao: string };
const extensoes: Record<SolicitarLaudoQualidadeInput["mimeType"], string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/xml": "xml", "text/xml": "xml" };
const dto = (l: ComprovanteEntregaLeite) => ({ id: l.id, nome: l.nome, mimeType: l.mimeType, tamanhoBytes: l.tamanhoBytes, criadoEm: l.criadoEm.toISOString(), criadoPorId: l.criadoPorId });
export async function solicitarComprovanteEntregaLeite(entregaId: string, propriedadeId: number, input: SolicitarLaudoQualidadeInput, usuarioId: number | null) {
  input = solicitarLaudoQualidadeSchema.parse(input);
  if (input.propriedadeId !== propriedadeId) throw new RebanhoError("VALIDACAO", "Sítio do upload incompatível");
  await obterEntregaLeiteTx(prisma, entregaId, propriedadeId);
  const comprovanteId = crypto.randomUUID(), extensao = extensoes[input.mimeType];
  return criarUploadDireto<DadosLaudo>({ temporarioKey: `tmp/${env.STORAGE_NAMESPACE}/entrega-leite/${comprovanteId}.${extensao}`, mimeType: input.mimeType, tamanhoBytes: input.tamanhoBytes, sha256: input.sha256,
    dados: { contexto: "ENTREGA_LEITE", entregaId, propriedadeId, usuarioId, comprovanteId, nome: input.nome, extensao } });
}
export async function confirmarComprovanteEntregaLeite(entregaId: string, propriedadeId: number, token: string, usuarioId: number | null) {
  let intent: ReturnType<typeof lerIntentUpload<DadosLaudo>>;
  try { intent = lerIntentUpload<DadosLaudo>(token); }
  catch { throw new RebanhoError("VALIDACAO", "Upload inválido ou expirado"); }
  if (intent.contexto !== "ENTREGA_LEITE" || intent.entregaId !== entregaId || intent.propriedadeId !== propriedadeId || intent.usuarioId !== usuarioId)
    throw new RebanhoError("NAO_ENCONTRADO", "Upload não encontrado para esta entrega");
  await obterEntregaLeiteTx(prisma, entregaId, propriedadeId);
  const existente = await prisma.comprovanteEntregaLeite.findUnique({ where: { entregaId_sha256: { entregaId, sha256: intent.sha256 } } });
  if (existente) return dto(existente);
  const storageKey = `${env.STORAGE_NAMESPACE}/pecuaria/leite/entregas/${propriedadeId}/${entregaId}/${intent.comprovanteId}.${intent.extensao}`;
  try { await promoverUploadDireto(intent, storageKey); }
  catch (erro) { if (erro instanceof UploadInvalidoError) throw new RebanhoError("VALIDACAO", erro.message); throw erro; }
  let laudo: ComprovanteEntregaLeite;
  try {
    laudo = await transacaoPecuaria(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-laudo-qualidade:${entregaId}:${intent.sha256}`}))`;
      const repetido = await tx.comprovanteEntregaLeite.findUnique({ where: { entregaId_sha256: { entregaId, sha256: intent.sha256 } } });
      if (repetido) return repetido;
      const criado = await tx.comprovanteEntregaLeite.create({ data: { id: intent.comprovanteId, entregaId, nome: intent.nome, mimeType: intent.mimeType,
        tamanhoBytes: intent.tamanhoBytes, sha256: intent.sha256, storageKey, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "EntregaLeite", entidadeId: entregaId, propriedadeId, usuarioId, acao: "LAUDO_ANEXADO", depois: { comprovante: dto(criado) } });
      return criado;
    });
  } catch (erro) {
    // Após uma resposta perdida, nunca remover o objeto já ligado ao laudo confirmado.
    const recuperado = await prisma.comprovanteEntregaLeite.findUnique({ where: { id: intent.comprovanteId } });
    if (recuperado) return dto(recuperado);
    await removerUploadPromovido(storageKey);
    throw erro;
  }
  if (laudo.storageKey !== storageKey) await removerUploadPromovido(storageKey);
  await removerUploadTemporario(intent.temporarioKey);
  return dto(laudo);
}
export async function baixarComprovanteEntregaLeite(entregaId: string, comprovanteId: string, propriedadeId: number) {
  const laudo = await prisma.comprovanteEntregaLeite.findFirst({ where: { id: comprovanteId, entregaId, entrega: { propriedadeId } } });
  if (!laudo) throw new RebanhoError("NAO_ENCONTRADO", "Comprovante não encontrado neste sítio");
  const filename = laudo.nome.replace(/[\r\n"\\]/g, "_");
  return { url: await (await getStorage()).getSignedDownloadUrl({ key: laudo.storageKey, filename, ttlSeconds: 600 }) };
}
