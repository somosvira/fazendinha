import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { obterConfig, salvarConfig } from "../../services/rebanho/config.js";
import { recomputarProducaoTodos } from "../../services/rebanho/producao.js";
import { configSchema } from "../../services/rebanho/producao.schemas.js";

export const configRouter = new Hono()
  .get("/rebanho/config", async (c) => c.json(await obterConfig()))
  .patch("/rebanho/config", zValidator("json", configSchema), async (c) => {
    const r = await salvarConfig(c.req.valid("json").producaoModo);
    await recomputarProducaoTodos();
    return c.json(r);
  });
