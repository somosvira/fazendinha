import { Hono } from "hono";
import { responderIA } from "../../services/corte/ia.js";

export const corteIaRouter = new Hono()
  .post("/corte/ia", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const pergunta = String(body?.pergunta ?? "").trim();
    if (!pergunta) return c.json({ resposta: "Faça uma pergunta sobre o plantel.", modo: "demo" });
    return c.json(responderIA(pergunta));
  });
