// Webhook do WhatsApp (Meta Cloud API).
//   GET  — verificação inicial (hub.challenge).
//   POST — recebe mensagens; valida X-Hub-Signature-256, responde 200 rápido e
//          processa em background (a Meta reentrega se demorar/der erro).

import { Hono } from "hono";
import { env } from "../env.js";
import { verificarAssinatura } from "../services/whatsapp/verify.js";
import { parseWebhook } from "../services/whatsapp/webhook.js";
import { processarMensagem } from "../services/whatsapp/handler.js";

export const whatsappRouter = new Hono()
  .get("/whatsapp/webhook", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode === "subscribe" && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
      return c.text(challenge ?? "");
    }
    return c.text("forbidden", 403);
  })
  .post("/whatsapp/webhook", async (c) => {
    const raw = await c.req.text();

    // Valida a assinatura quando há App Secret (em prod é obrigatório).
    if (env.WHATSAPP_APP_SECRET) {
      const sig = c.req.header("x-hub-signature-256");
      if (!verificarAssinatura(raw, sig, env.WHATSAPP_APP_SECRET)) {
        return c.text("invalid signature", 401);
      }
    } else {
      console.warn("[whatsapp] WHATSAPP_APP_SECRET ausente — assinatura NÃO validada (ok só em dev).");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.text("bad json", 400);
    }

    // Responde 200 já; processa cada mensagem em background.
    for (const m of parseWebhook(body)) {
      processarMensagem(m).catch((e) => console.error("[whatsapp] erro ao processar:", e));
    }
    return c.json({ ok: true });
  });
