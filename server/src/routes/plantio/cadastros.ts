import { Hono } from "hono";
import { lavouras, planosAdubacao } from "../../services/plantio/mock.js";

/* Cadastros estáticos do Plantio — lavouras (agrupadores) e planos de adubação.
 * Espelha /api/rebanho/{lotes,dietas}. */
export const plantioCadastrosRouter = new Hono()
  .get("/plantio/lavouras", (c) => c.json(lavouras))
  .get("/plantio/planos-adubacao", (c) => c.json(planosAdubacao));
