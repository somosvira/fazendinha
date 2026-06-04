// Handler de foto/PDF recebido pelo bot. Fluxo:
//   download -> validação síncrona -> dedupe contra NotaFiscalArquivo ->
//   put no storage (key "notas/_wa/<sha>.<ext>") -> Claude Vision ->
//   fecha sessão pendente anterior do mesmo telefone -> cria WhatsAppConfirmacaoPendente ->
//   envia cartão de confirmação -> marca msg como lida.

import type { WASocket, proto } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import PQueue from "p-queue";
import { prisma } from "../../../db.js";
import { persistirArquivoParaConfirmacao } from "../../notaFiscal/uploadArquivo.js";
import { extrairNotaFiscal } from "../../../lib/visionExtractor.js";
import { telefoneDeJid } from "../autorizacao.js";
import {
  cartaoConfirmacao,
  msgValidacaoFalhou,
  msgDuplicata,
  MSG_TIPO_NAO_SUPORTADO,
  MSG_ARQUIVO_GRANDE,
  MSG_EXTRACAO_FALHOU,
  MSG_ERRO_INTERNO,
} from "../respostas.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TTL_CONFIRMACAO_MS = 30 * 60 * 1000;

// Limita chamadas concorrentes à Anthropic — rajada de 5 fotos não estoura quota.
const visionQueue = new PQueue({ concurrency: 3 });

type ProcessarArgs = {
  jid: string;
  mensagemId: string;
  midia: { tipo: "image" | "document"; message: proto.IWebMessageInfo };
};

export async function processarMidia(sock: WASocket, args: ProcessarArgs): Promise<void> {
  const { jid, mensagemId, midia } = args;
  const telefone = telefoneDeJid(jid);

  const m = midia.message;
  const mime =
    midia.tipo === "image"
      ? m.message?.imageMessage?.mimetype ?? "image/jpeg"
      : m.message?.documentMessage?.mimetype ?? "application/octet-stream";

  if (!["image/jpeg", "image/png", "application/pdf"].includes(mime)) {
    await sock.sendMessage(jid, { text: MSG_TIPO_NAO_SUPORTADO });
    return;
  }

  const fileLength =
    midia.tipo === "image"
      ? Number(m.message?.imageMessage?.fileLength ?? 0)
      : Number(m.message?.documentMessage?.fileLength ?? 0);
  if (fileLength && fileLength > MAX_UPLOAD_BYTES) {
    await sock.sendMessage(jid, { text: MSG_ARQUIVO_GRANDE });
    return;
  }

  // Download
  let buffer: Buffer;
  try {
    const baixado = await downloadMediaMessage(
      m,
      "buffer",
      {},
      { logger: console as never, reuploadRequest: sock.updateMediaMessage },
    );
    buffer = baixado as Buffer;
  } catch (e) {
    console.error("[wpp] downloadMediaMessage falhou:", e);
    await sock.sendMessage(jid, { text: MSG_ERRO_INTERNO });
    return;
  }

  // Validação síncrona + persistência no storage (key notas/_wa/<sha>.<ext>)
  const persist = await persistirArquivoParaConfirmacao({
    buffer,
    mimeTypeDeclarado: mime,
    keyPrefix: "notas/_wa",
  });

  if (!persist.ok) {
    if (persist.codigo === "DUPLICATA" && persist.duplicata) {
      await sock.sendMessage(jid, { text: msgDuplicata(persist.duplicata.lancamentoId) });
      return;
    }
    await sock.sendMessage(jid, { text: msgValidacaoFalhou(persist.mensagem) });
    return;
  }

  const metadados = persist.metadados;

  // "Digitando…" enquanto a Vision processa
  await sock.sendPresenceUpdate("composing", jid).catch(() => undefined);

  const extracao = await visionQueue.add(() =>
    extrairNotaFiscal({
      buffer,
      mimeType: metadados.mimeTypeReal as "image/jpeg" | "image/png" | "application/pdf",
    }),
  );

  await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);

  if (!extracao || !extracao.ok) {
    console.warn("[wpp] extração falhou", extracao);
    // Cria registro de erro pra auditoria
    await prisma.whatsAppConfirmacaoPendente.create({
      data: {
        telefone,
        jid,
        mensagemId,
        storageDriver: metadados.storageDriver,
        bucket: metadados.bucket,
        storageKey: metadados.storageKey,
        sha256: metadados.sha256,
        mimeType: metadados.mimeTypeReal,
        tamanhoBytes: metadados.tamanhoBytes,
        dadosExtraidos: { erro: extracao?.motivo ?? "DESCONHECIDO", mensagem: extracao?.mensagem ?? "" },
        modeloIa: "n/a",
        status: "ERRO_EXTRACAO",
        expiraEm: new Date(Date.now() + TTL_CONFIRMACAO_MS),
      },
    });
    await sock.sendMessage(jid, { text: MSG_EXTRACAO_FALHOU });
    return;
  }

  // Override: fecha qualquer AGUARDANDO anterior desse telefone antes de criar nova.
  const overrideResult = await prisma.whatsAppConfirmacaoPendente.updateMany({
    where: { telefone, status: "AGUARDANDO" },
    data: { status: "CANCELADA", decididoEm: new Date() },
  });
  const overrideAnterior = overrideResult.count > 0;

  await prisma.whatsAppConfirmacaoPendente.create({
    data: {
      telefone,
      jid,
      mensagemId,
      storageDriver: metadados.storageDriver,
      bucket: metadados.bucket,
      storageKey: metadados.storageKey,
      sha256: metadados.sha256,
      mimeType: metadados.mimeTypeReal,
      tamanhoBytes: metadados.tamanhoBytes,
      dadosExtraidos: extracao.dados as object,
      modeloIa: extracao.modelo,
      tokensInput: extracao.tokensInput,
      tokensOutput: extracao.tokensOutput,
      status: "AGUARDANDO",
      expiraEm: new Date(Date.now() + TTL_CONFIRMACAO_MS),
    },
  });

  const texto = cartaoConfirmacao(extracao.dados, { overrideAnterior });
  await sock.sendMessage(jid, { text: texto });
  await sock.readMessages([m.key]).catch(() => undefined);
}
