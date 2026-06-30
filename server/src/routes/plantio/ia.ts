import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responderIA } from "../../services/plantio/ia.js";

const schema = z.object({ pergunta: z.string().min(1).max(2000) });

export const plantioIaRouter = new Hono().post("/plantio/ia", zValidator("json", schema), async (c) =>
  c.json(await responderIA(c.req.valid("json").pergunta)),
);
