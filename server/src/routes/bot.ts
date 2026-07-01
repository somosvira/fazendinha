// Rota interna de teste do bot — exercita o cérebro (agente OpenAI + ferramentas)
// sem precisar do WhatsApp plugado. O canal WhatsApp real entra em routes/whatsapp.ts.
//
// Passe "sessao" para manter contexto entre chamadas (follow-ups). Sem ela, é
// stateless. No WhatsApp, a "sessao" será o telefone do usuário.

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { perguntar, BotDesligadoError } from "../services/bot/agent.js";
import { carregarHistorico, registrarTroca } from "../services/bot/conversa.js";

const schema = z.object({
  pergunta: z.string().min(1).max(2000),
  sessao: z.string().min(1).max(120).optional(),
});

export const botRouter = new Hono().post("/bot/ask", zValidator("json", schema), async (c) => {
  try {
    const { pergunta, sessao } = c.req.valid("json");
    const chave = sessao ? `test:${sessao}` : undefined;
    const historico = chave ? await carregarHistorico(chave) : [];
    const r = await perguntar(pergunta, historico);
    if (chave) await registrarTroca(chave, pergunta, r.resposta);
    return c.json({ ...r, sessao: sessao ?? null });
  } catch (e) {
    if (e instanceof BotDesligadoError) return c.json({ erro: e.message }, 503);
    return c.json({ erro: e instanceof Error ? e.message : "erro" }, 500);
  }
});
