import crypto from "node:crypto";
import { prisma } from "../../../db.js";
import { env } from "../../../env.js";
import { getStorage } from "../../../lib/storage.js";
import {
  criarUploadDireto,
  lerIntentUpload,
  promoverUploadDireto,
  removerUploadPromovido,
  removerUploadTemporario,
  UploadInvalidoError,
} from "../../../lib/uploads.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
async function obterRetiradaTx(
  db: typeof prisma,
  retiradaId: string,
  propriedadeId: number,
) {
  const r = await db.retiradaOperacaoLeite.findFirst({
    where: { id: retiradaId, comercial: { propriedadeId } },
    select: { id: true },
  });
  if (!r)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Retirada não encontrada neste sítio",
    );
  return r;
}
import {
  solicitarLaudoQualidadeSchema,
  type SolicitarLaudoQualidadeInput,
} from "./qualidade.schemas.js";
import type { ComprovanteRetiradaOperacaoLeite } from "@prisma/client";

type DadosLaudo = {
  contexto: "RETIRADA_OPERACAO_LEITE";
  retiradaId: string;
  propriedadeId: number;
  usuarioId: number | null;
  comprovanteId: string;
  nome: string;
  extensao: string;
};
const extensoes: Record<SolicitarLaudoQualidadeInput["mimeType"], string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/xml": "xml",
  "text/xml": "xml",
};
const dto = (l: ComprovanteRetiradaOperacaoLeite) => ({
  id: l.id,
  nome: l.nome,
  mimeType: l.mimeType,
  tamanhoBytes: l.tamanhoBytes,
  criadoEm: l.criadoEm.toISOString(),
  criadoPorId: l.criadoPorId,
});
export async function solicitarComprovanteRetiradaOperacaoLeite(
  retiradaId: string,
  propriedadeId: number,
  input: SolicitarLaudoQualidadeInput,
  usuarioId: number | null,
) {
  input = solicitarLaudoQualidadeSchema.parse(input);
  if (input.propriedadeId !== propriedadeId)
    throw new RebanhoError("VALIDACAO", "Sítio do upload incompatível");
  await obterRetiradaTx(prisma, retiradaId, propriedadeId);
  const comprovanteId = crypto.randomUUID(),
    extensao = extensoes[input.mimeType];
  return criarUploadDireto<DadosLaudo>({
    temporarioKey: `tmp/${env.STORAGE_NAMESPACE}/retirada-operacao-leite/${comprovanteId}.${extensao}`,
    mimeType: input.mimeType,
    tamanhoBytes: input.tamanhoBytes,
    sha256: input.sha256,
    dados: {
      contexto: "RETIRADA_OPERACAO_LEITE",
      retiradaId,
      propriedadeId,
      usuarioId,
      comprovanteId,
      nome: input.nome,
      extensao,
    },
  });
}
export async function confirmarComprovanteRetiradaOperacaoLeite(
  retiradaId: string,
  propriedadeId: number,
  token: string,
  usuarioId: number | null,
) {
  let intent: ReturnType<typeof lerIntentUpload<DadosLaudo>>;
  try {
    intent = lerIntentUpload<DadosLaudo>(token);
  } catch {
    throw new RebanhoError("VALIDACAO", "Upload inválido ou expirado");
  }
  if (
    intent.contexto !== "RETIRADA_OPERACAO_LEITE" ||
    intent.retiradaId !== retiradaId ||
    intent.propriedadeId !== propriedadeId ||
    intent.usuarioId !== usuarioId
  )
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Upload não encontrado para esta entrega",
    );
  await obterRetiradaTx(prisma, retiradaId, propriedadeId);
  const existente = await prisma.comprovanteRetiradaOperacaoLeite.findUnique({
    where: { retiradaId_sha256: { retiradaId, sha256: intent.sha256 } },
  });
  if (existente) return dto(existente);
  const storageKey = `${env.STORAGE_NAMESPACE}/pecuaria/leite/retiradas-operacao/${propriedadeId}/${retiradaId}/${intent.comprovanteId}.${intent.extensao}`;
  try {
    await promoverUploadDireto(intent, storageKey);
  } catch (erro) {
    if (erro instanceof UploadInvalidoError)
      throw new RebanhoError("VALIDACAO", erro.message);
    throw erro;
  }
  let laudo: ComprovanteRetiradaOperacaoLeite;
  try {
    laudo = await transacaoPecuaria(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-retirada-comprovante:${retiradaId}:${intent.sha256}`}))`;
      const repetido = await tx.comprovanteRetiradaOperacaoLeite.findUnique({
        where: { retiradaId_sha256: { retiradaId, sha256: intent.sha256 } },
      });
      if (repetido) return repetido;
      const criado = await tx.comprovanteRetiradaOperacaoLeite.create({
        data: {
          id: intent.comprovanteId,
          retiradaId,
          nome: intent.nome,
          mimeType: intent.mimeType,
          tamanhoBytes: intent.tamanhoBytes,
          sha256: intent.sha256,
          storageKey,
          criadoPorId: usuarioId,
        },
      });
      await auditar(tx, {
        entidade: "EntregaLeite",
        entidadeId: retiradaId,
        propriedadeId,
        usuarioId,
        acao: "LAUDO_ANEXADO",
        depois: { comprovante: dto(criado) },
      });
      return criado;
    });
  } catch (erro) {
    // Após uma resposta perdida, nunca remover o objeto já ligado ao laudo confirmado.
    const recuperado = await prisma.comprovanteRetiradaOperacaoLeite.findUnique(
      { where: { id: intent.comprovanteId } },
    );
    if (recuperado) return dto(recuperado);
    await removerUploadPromovido(storageKey);
    throw erro;
  }
  if (laudo.storageKey !== storageKey) await removerUploadPromovido(storageKey);
  await removerUploadTemporario(intent.temporarioKey);
  return dto(laudo);
}
export async function baixarComprovanteRetiradaOperacaoLeite(
  retiradaId: string,
  comprovanteId: string,
  propriedadeId: number,
) {
  const laudo = await prisma.comprovanteRetiradaOperacaoLeite.findFirst({
    where: {
      id: comprovanteId,
      retiradaId,
      retirada: { comercial: { propriedadeId } },
    },
  });
  if (!laudo)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Comprovante não encontrado neste sítio",
    );
  const filename = laudo.nome.replace(/[\r\n"\\]/g, "_");
  return {
    url: await (
      await getStorage()
    ).getSignedDownloadUrl({
      key: laudo.storageKey,
      filename,
      ttlSeconds: 600,
    }),
  };
}
