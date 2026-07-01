import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responderIA, listarInsightsPlantio } from "../../services/plantio/ia.js";

// Aceita string vazia: o widget de chat pode mandar pergunta em branco enquanto
// o usuário digita. Em vez de devolver 400 do Zod, respondemos com o convite.
const schema = z.object({ pergunta: z.string().max(2000) });

export const plantioIaRouter = new Hono()
  .post("/plantio/ia", zValidator("json", schema), async (c) => {
    const pergunta = c.req.valid("json").pergunta.trim();
    if (!pergunta) return c.json({ resposta: "Faça uma pergunta sobre a lavoura.", modo: "demo" as const });
    return c.json(await responderIA(pergunta));
  })
  // Cards proativos "insights da semana" (sidebar da IA) — dados reais da lavoura.
  .get("/plantio/ia/insights", async (c) => c.json(await listarInsightsPlantio()));
