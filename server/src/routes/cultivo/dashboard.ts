import { Hono } from "hono";
import { buildCultivoDashboard } from "../../services/cultivo/dashboard.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const cultivoDashboardRouter = new Hono()
  .get("/cultivo/dashboard", async (c) => c.json(await buildCultivoDashboard(await resolverEscopoLeitura(c))));
