import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responderPergunta, listarInsightsRebanho } from "../../services/rebanho/ia.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

const schema = z.object({ pergunta: z.string().min(1).max(2000) });

export const iaRouter = new Hono()
  .post("/rebanho/ia", zValidator("json", schema), async (c) =>
    c.json(await responderPergunta(c.req.valid("json").pergunta, await resolverEscopoLeitura(c))),
  )
  // Cards proativos "insights da semana" (sidebar da IA) — dados reais do rebanho.
  .get("/rebanho/ia/insights", async (c) => c.json(await listarInsightsRebanho(await resolverEscopoLeitura(c))));
