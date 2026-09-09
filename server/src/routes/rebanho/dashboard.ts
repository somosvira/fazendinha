import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { buildRebanhoDashboard } from "../../services/rebanho/dashboard-rebanho.js";
import { buildResumoMensalRebanho } from "../../services/rebanho/resumo-mensal.js";

const querySchema = z.object({ periodo: z.enum(["hoje", "7d", "30d"]).default("7d") });
const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((dia) => !Number.isNaN(Date.parse(`${dia}T00:00:00Z`)), "Data inválida");
const resumoMensalQuerySchema = z.object({ from: diaSchema, to: diaSchema }).refine((q) => q.from <= q.to, { message: "Período inválido", path: ["to"] });

export const rebanhoDashboardRouter = new Hono()
  .get(
    "/rebanho/dashboard",
    zValidator("query", querySchema),
    async (c) => {
      const { periodo } = c.req.valid("query");
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await buildRebanhoDashboard(periodo, propriedadeId));
    },
  )
  .get(
    "/rebanho/resumo-mensal",
    zValidator("query", resumoMensalQuerySchema),
    async (c) => {
      const { from, to } = c.req.valid("query");
      return c.json(await buildResumoMensalRebanho(from, to, await resolverEscopoLeitura(c)));
    },
  );
