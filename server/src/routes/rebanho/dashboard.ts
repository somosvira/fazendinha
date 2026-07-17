import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { buildRebanhoDashboard } from "../../services/rebanho/dashboard-rebanho.js";

const querySchema = z.object({ periodo: z.enum(["hoje", "7d", "30d"]).default("7d") });

export const rebanhoDashboardRouter = new Hono().get(
  "/rebanho/dashboard",
  zValidator("query", querySchema),
  async (c) => {
    const { periodo } = c.req.valid("query");
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await buildRebanhoDashboard(periodo, propriedadeId));
  },
);
