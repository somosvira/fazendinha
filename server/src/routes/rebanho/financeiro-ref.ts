import { Hono } from "hono";
import * as svc from "../../services/rebanho/financeiro-ref.js";

export const financeiroRefRouter = new Hono()
  .get("/rebanho/categorias", async (c) => c.json(await svc.listarCategorias()))
  .get("/rebanho/centros-custo", async (c) => c.json(await svc.listarCentrosCusto()));
