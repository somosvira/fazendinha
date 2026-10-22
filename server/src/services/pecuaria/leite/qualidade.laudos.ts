import crypto from "node:crypto";
import { prisma } from "../../../db.js";
import { env } from "../../../env.js";
import { getStorage } from "../../../lib/storage.js";
import { criarUploadDireto, lerIntentUpload, promoverUploadDireto, removerUploadPromovido, removerUploadTemporario, UploadInvalidoError } from "../../../lib/uploads.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { obterAmostraQualidadeTx } from "./qualidade.js";
import { solicitarLaudoQualidadeSchema, type SolicitarLaudoQualidadeInput } from "./qualidade.schemas.js";
import type { LaudoQualidadeLeite } from "@prisma/client";
import type { LaudoQualidadeDTO } from "./qualidade.contratos.js";

type DadosLaudo = { contexto: "QUALIDADE_LEITE"; amostraId: string; propriedadeId: number; usuarioId: number | null; laudoId: string; nome: string; extensao: string };
const extensoes: Record<SolicitarLaudoQualidadeInput["mimeType"], string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/xml": "xml", "text/xml": "xml" };
const dto = (l: LaudoQualidadeLeite): LaudoQualidadeDTO => ({ id: l.id, nome: l.nome, mimeType: l.mimeType, tamanhoBytes: l.tamanhoBytes, criadoEm: l.criadoEm.toISOString(), criadoPorId: l.criadoPorId });
export async function solicitarLaudoQualidade(amostraId: string, propriedadeId: number, input: SolicitarLaudoQualidadeInput, usuarioId: number | null) {
  input = solicitarLaudoQualidadeSchema.parse(input);
  if (input.propriedadeId !== propriedadeId) throw new RebanhoError("VALIDACAO", "Sítio do upload incompatível");
  await obterAmostraQualidadeTx(prisma, amostraId, propriedadeId);
  const laudoId = crypto.randomUUID(), extensao = extensoes[input.mimeType];
  return criarUploadDireto<DadosLaudo>({ temporarioKey: `tmp/${env.STORAGE_NAMESPACE}/qualidade-leite/${laudoId}.${extensao}`, mimeType: input.mimeType, tamanhoBytes: input.tamanhoBytes, sha256: input.sha256,
    dados: { contexto: "QUALIDADE_LEITE", amostraId, propriedadeId, usuarioId, laudoId, nome: input.nome, extensao } });
}
export async function confirmarLaudoQualidade(amostraId: string, propriedadeId: number, token: string, usuarioId: number | null) {
  let intent: ReturnType<typeof lerIntentUpload<DadosLaudo>>;
  try { intent = lerIntentUpload<DadosLaudo>(token); }
  catch { throw new RebanhoError("VALIDACAO", "Upload inválido ou expirado"); }
  if (intent.contexto !== "QUALIDADE_LEITE" || intent.amostraId !== amostraId || intent.propriedadeId !== propriedadeId || intent.usuarioId !== usuarioId)
    throw new RebanhoError("NAO_ENCONTRADO", "Upload não encontrado para esta amostra");
  await obterAmostraQualidadeTx(prisma, amostraId, propriedadeId);
  const existente = await prisma.laudoQualidadeLeite.findUnique({ where: { amostraId_sha256: { amostraId, sha256: intent.sha256 } } });
  if (existente) return dto(existente);
  const storageKey = `${env.STORAGE_NAMESPACE}/pecuaria/leite/qualidade/${propriedadeId}/${amostraId}/${intent.laudoId}.${intent.extensao}`;
  try { await promoverUploadDireto(intent, storageKey); }
  catch (erro) { if (erro instanceof UploadInvalidoError) throw new RebanhoError("VALIDACAO", erro.message); throw erro; }
  let laudo: LaudoQualidadeLeite;
  try {
    laudo = await transacaoPecuaria(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-laudo-qualidade:${amostraId}:${intent.sha256}`}))`;
      const repetido = await tx.laudoQualidadeLeite.findUnique({ where: { amostraId_sha256: { amostraId, sha256: intent.sha256 } } });
      if (repetido) return repetido;
      const criado = await tx.laudoQualidadeLeite.create({ data: { id: intent.laudoId, amostraId, nome: intent.nome, mimeType: intent.mimeType,
        tamanhoBytes: intent.tamanhoBytes, sha256: intent.sha256, storageDriver: "r2", bucket: env.R2_BUCKET_NOTAS, storageKey, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "AmostraQualidadeLeite", entidadeId: amostraId, propriedadeId, usuarioId, acao: "LAUDO_ANEXADO", depois: { laudo: dto(criado) } });
      return criado;
    });
  } catch (erro) {
    // Após uma resposta perdida, nunca remover o objeto já ligado ao laudo confirmado.
    const recuperado = await prisma.laudoQualidadeLeite.findUnique({ where: { id: intent.laudoId } });
    if (recuperado) return dto(recuperado);
    await removerUploadPromovido(storageKey);
    throw erro;
  }
  if (laudo.storageKey !== storageKey) await removerUploadPromovido(storageKey);
  await removerUploadTemporario(intent.temporarioKey);
  return dto(laudo);
}
export async function baixarLaudoQualidade(amostraId: string, laudoId: string, propriedadeId: number) {
  const laudo = await prisma.laudoQualidadeLeite.findFirst({ where: { id: laudoId, amostraId, amostra: { propriedadeId } } });
  if (!laudo) throw new RebanhoError("NAO_ENCONTRADO", "Laudo não encontrado neste sítio");
  const filename = laudo.nome.replace(/[\r\n"\\]/g, "_");
  return { url: await (await getStorage()).getSignedDownloadUrl({ key: laudo.storageKey, filename, ttlSeconds: 600 }) };
}
