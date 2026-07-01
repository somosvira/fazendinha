import { describe, it, expect } from "vitest";
import { parseWebhook } from "./webhook.js";

// Payload real (resumido) da Meta para uma mensagem de texto.
const payloadTexto = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "PHONE_ID" },
            messages: [
              { from: "5531999999999", id: "wamid.ABC", timestamp: "1700000000", type: "text", text: { body: "qual o saldo?" } },
            ],
          },
        },
      ],
    },
  ],
};

describe("parseWebhook", () => {
  it("extrai mensagem de texto", () => {
    const msgs = parseWebhook(payloadTexto);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ from: "5531999999999", waMessageId: "wamid.ABC", type: "text", text: "qual o saldo?" });
  });

  it("extrai imagem com mediaId e text null", () => {
    const p = {
      entry: [{ changes: [{ value: { messages: [{ from: "553199", id: "wamid.IMG", type: "image", image: { id: "MEDIA_1" } }] } }] }],
    };
    expect(parseWebhook(p)[0]).toMatchObject({ type: "image", text: null, mediaId: "MEDIA_1" });
  });

  it("ignora eventos de status (sem messages)", () => {
    const status = {
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.X", status: "delivered" }] } }] }],
    };
    expect(parseWebhook(status)).toHaveLength(0);
  });

  it("suporta lote de mensagens", () => {
    const lote = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "1", id: "a", type: "text", text: { body: "oi" } },
                  { from: "2", id: "b", type: "text", text: { body: "olá" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseWebhook(lote)).toHaveLength(2);
  });

  it("descarta mensagem sem from/id", () => {
    const ruim = { entry: [{ changes: [{ value: { messages: [{ type: "text", text: { body: "x" } }] } }] }] };
    expect(parseWebhook(ruim)).toHaveLength(0);
  });

  it("não quebra com payload vazio", () => {
    expect(parseWebhook({})).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
  });
});
