// Dispatcher do evento messages.upsert. Filtra DMs autorizadas, separa entre
// midia (foto/PDF) e texto (Confirmar/Cancelar). Mensagens fora do escopo são
// silenciosamente ignoradas — não vira chatbot.

import type { WASocket, BaileysEventMap, proto } from "@whiskeysockets/baileys";
import { isNumeroAutorizado } from "../autorizacao.js";
import { processarMidia } from "./midia.js";
import { processarTexto } from "./texto.js";

const TOLERANCIA_BOOT_MS = 60_000;

type MessagesUpsertEv = BaileysEventMap["messages.upsert"];

export async function onMessagesUpsert(
  sock: WASocket,
  ev: MessagesUpsertEv,
  botStartedAt: number,
): Promise<void> {
  for (const m of ev.messages) {
    try {
      await tratarMensagem(sock, m, botStartedAt);
    } catch (e) {
      console.error("[wpp] tratarMensagem falhou:", e);
    }
  }
}

async function tratarMensagem(sock: WASocket, m: proto.IWebMessageInfo, botStartedAt: number): Promise<void> {
  if (!m.message || m.key.fromMe) return;

  const jid = m.key.remoteJid;
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return; // só DM

  if (!isNumeroAutorizado(jid)) {
    console.log("[wpp] ignorando mensagem de número não autorizado", {
      jid_mascarado: jid.replace(/(\d{4})(\d+)(\d{2})@/, "$1****$3@"),
    });
    return;
  }

  // Dropar mensagens antigas (rajada de reconexão) — só processa o que chegou
  // depois do boot ou no máximo 60s antes.
  const tsSeg = Number(m.messageTimestamp ?? 0);
  if (tsSeg && tsSeg * 1000 < botStartedAt - TOLERANCIA_BOOT_MS) {
    return;
  }

  const msg = m.message;
  const mensagemId = m.key.id ?? "";

  if (msg.imageMessage) {
    await processarMidia(sock, { jid, mensagemId, midia: { tipo: "image", message: m } });
    return;
  }
  if (msg.documentMessage) {
    const mime = msg.documentMessage.mimetype ?? "";
    if (["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
      await processarMidia(sock, { jid, mensagemId, midia: { tipo: "document", message: m } });
      return;
    }
  }

  // Áudio (inclui PTT, que vem como audioMessage com ptt=true), vídeo, sticker,
  // contato, localização → tipo não suportado.
  if (
    msg.audioMessage ||
    msg.videoMessage ||
    msg.stickerMessage ||
    msg.contactMessage ||
    msg.locationMessage
  ) {
    const { MSG_TIPO_NAO_SUPORTADO } = await import("../respostas.js");
    await sock.sendMessage(jid, { text: MSG_TIPO_NAO_SUPORTADO });
    return;
  }

  // Texto puro: pode ser resposta a confirmação pendente.
  const texto = msg.conversation ?? msg.extendedTextMessage?.text ?? null;
  if (texto) {
    await processarTexto(sock, { jid, texto });
    return;
  }
}
