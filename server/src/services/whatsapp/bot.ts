// Bootstrap do bot Baileys. Gateado por env.WHATSAPP_ENABLED — quando false,
// nem importa o módulo Baileys (lazy dynamic import dentro da função). Isso
// significa que CI / dev sem chave podem rodar o server sem dor.
//
// State machine de conexão: reconecta em qualquer DisconnectReason exceto
// loggedOut (sessão revogada — exige novo QR manual). Backoff exponencial cap 60s.

import type { WASocket, ConnectionState } from "@whiskeysockets/baileys";
import { env } from "../../env.js";

type Estado = "DESLIGADO" | "CONECTANDO" | "OPEN" | "RECONECTANDO" | "DEAD";

let sock: WASocket | null = null;
let estado: Estado = "DESLIGADO";
let tentativasReconexao = 0;
let botStartedAt: number = 0;

export function getSock(): WASocket {
  if (!sock || estado !== "OPEN") {
    throw new Error(`bot WhatsApp não está conectado (estado=${estado})`);
  }
  return sock;
}

export function getEstadoBot(): { estado: Estado; tentativas: number; iniciadoEm: number } {
  return { estado, tentativas: tentativasReconexao, iniciadoEm: botStartedAt };
}

export async function iniciarBotWhatsapp(): Promise<void> {
  if (!env.WHATSAPP_ENABLED) {
    console.log("[wpp] WHATSAPP_ENABLED=false — bot não inicializado.");
    return;
  }
  if (estado === "CONECTANDO" || estado === "OPEN") return;
  estado = "CONECTANDO";

  // Lazy imports — Baileys puxa libsignal e outras deps nativas; só carrega quando ligado.
  const baileysMod = await import("@whiskeysockets/baileys");
  const makeWASocket = baileysMod.default;
  const { fetchLatestBaileysVersion, DisconnectReason, Browsers } = baileysMod;
  const { carregarAuthState } = await import("./sessao.js");
  const { onMessagesUpsert } = await import("./handlers/mensagem.js");

  const { state, saveCreds } = await carregarAuthState();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[wpp] usando Baileys v${version.join(".")} (latest=${isLatest})`);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: Browsers.appropriate("Desktop"),
  });
  botStartedAt = Date.now();

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      console.log("[wpp] escaneie o QR acima (WhatsApp -> Aparelhos conectados).");
    }
    if (connection === "open") {
      estado = "OPEN";
      tentativasReconexao = 0;
      console.log("[wpp] conectado.");
      return;
    }
    if (connection === "close") {
      const erro = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
      const code = erro?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut || code === DisconnectReason.connectionReplaced;
      if (isLoggedOut) {
        estado = "DEAD";
        console.error(
          `[wpp] sessão encerrada (code=${code}). Apague ${env.WHATSAPP_AUTH_DIR}/ e reinicie pra parear de novo.`,
        );
        sock = null;
        return;
      }
      estado = "RECONECTANDO";
      tentativasReconexao += 1;
      const delay = Math.min(60_000, 1_000 * 2 ** Math.min(tentativasReconexao, 6));
      console.warn(
        `[wpp] desconectado (code=${code}). Tentando reconectar em ${delay / 1000}s (tentativa ${tentativasReconexao}).`,
      );
      sock = null;
      setTimeout(() => {
        estado = "DESLIGADO"; // libera o guard de "já conectando" no início
        iniciarBotWhatsapp().catch((e) => {
          console.error("[wpp] reconexão falhou:", e);
        });
      }, delay);
    }
  });

  sock.ev.on("messages.upsert", (ev) => {
    if (!sock) return;
    onMessagesUpsert(sock, ev, botStartedAt).catch((e) => {
      console.error("[wpp] erro processando mensagem:", e);
    });
  });
}

// Encerra sock de forma limpa (chamado no SIGTERM/SIGINT pra evitar sessão "fantasma").
export async function encerrarBotWhatsapp(): Promise<void> {
  if (!sock) return;
  try {
    sock.end(undefined);
  } catch {
    /* ignore */
  }
  sock = null;
  estado = "DESLIGADO";
}
