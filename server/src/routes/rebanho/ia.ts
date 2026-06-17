import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responderPergunta } from "../../services/rebanho/ia.js";

const schema = z.object({ pergunta: z.string().min(1).max(2000) });

export const iaRouter = new Hono().post("/rebanho/ia", zValidator("json", schema), async (c) =>
  c.json(await responderPergunta(c.req.valid("json").pergunta)),
);
