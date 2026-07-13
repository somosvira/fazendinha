import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { buildPontoDashboard, mesCorrente } from "../../services/ponto/dashboard.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

// mes opcional (YYYY-MM). Ausente → mês corrente (server-side).
const querySchema = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/, "mês deve ser YYYY-MM").optional() });

export const pontoDashboardRouter = new Hono().get(
  "/ponto/dashboard",
  zValidator("query", querySchema),
  async (c) => {
    const mes = c.req.valid("query").mes ?? mesCorrente();
    return c.json(await buildPontoDashboard(mes, await resolverEscopoLeitura(c)));
  },
);
