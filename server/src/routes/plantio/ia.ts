import { Hono } from "hono";
import { responderIA } from "../../services/plantio/ia.js";

export const plantioIaRouter = new Hono()
  .post("/plantio/ia", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const pergunta = String(body?.pergunta ?? "").trim();
    if (!pergunta) return c.json({ resposta: "Faça uma pergunta sobre a lavoura.", modo: "demo" });
    return c.json(responderIA(pergunta));
  });
