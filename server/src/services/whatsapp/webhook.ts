// Parser do payload de webhook da Meta (WhatsApp Cloud API) → mensagens
// normalizadas. Função PURA. Ignora eventos de status (entregue/lido) e tipos
// sem texto (por enquanto). Suporta lote (várias mensagens num POST).

export interface MensagemRecebida {
  from: string; // telefone E.164 sem "+", ex.: "5531999999999"
  waMessageId: string; // wamid... (para dedupe)
  type: string; // text | image | audio | ...
  text: string | null;
  // referência de mídia (Phase 4 — OCR de nota fiscal)
  mediaId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseWebhook(body: any): MensagemRecebida[] {
  const out: MensagemRecebida[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      for (const m of value?.messages ?? []) {
        const tipo = m?.type ?? "unknown";
        out.push({
          from: m?.from ?? "",
          waMessageId: m?.id ?? "",
          type: tipo,
          text: tipo === "text" ? (m?.text?.body ?? null) : null,
          mediaId: tipo === "image" ? (m?.image?.id ?? null) : tipo === "document" ? (m?.document?.id ?? null) : null,
        });
      }
    }
  }
  return out.filter((m) => m.from && m.waMessageId);
}
