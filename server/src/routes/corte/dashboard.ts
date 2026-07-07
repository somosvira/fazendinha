import { Hono } from "hono";
import { buildCorteDashboard } from "../../services/corte/dashboard.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const corteDashboardRouter = new Hono()
  .get("/corte/dashboard", async (c) => c.json(await buildCorteDashboard(await resolverEscopoLeitura(c))));
