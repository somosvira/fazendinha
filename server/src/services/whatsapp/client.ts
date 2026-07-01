// Cliente de envio da WhatsApp Cloud API (Graph). Sem os tokens configurados,
// apenas loga (útil em dev/teste). Mensagens de texto têm teto de 4096 chars.

import { env } from "../../env.js";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function enviarTexto(to: string, texto: string): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.warn(`[whatsapp] tokens ausentes — mensagem NÃO enviada para ${to}: ${texto.slice(0, 80)}…`);
    return;
  }
  try {
    const res = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: texto.slice(0, 4096) },
      }),
    });
    if (!res.ok) console.error(`[whatsapp] envio falhou ${res.status}:`, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[whatsapp] erro de rede ao enviar:", e);
  }
}
