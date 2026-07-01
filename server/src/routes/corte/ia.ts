import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responderIA, listarInsightsCorte } from "../../services/corte/ia.js";

// IA do plantel de corte — espelha /api/rebanho/ia e /api/plantio/ia.
// pergunta vazia → 400 (ZodError do zValidator).
const schema = z.object({ pergunta: z.string().min(1).max(2000) });

export const corteIaRouter = new Hono()
  .post("/corte/ia", zValidator("json", schema), async (c) =>
    c.json(await responderIA(c.req.valid("json").pergunta)),
  )
  // Cards proativos "insights da semana" (sidebar da IA) — dados reais do corte.
  .get("/corte/ia/insights", async (c) => c.json(await listarInsightsCorte()));
