import { Hono } from "hono";
import * as svc from "../../services/plantio/cadastros.js";

/* Cadastros do Plantio — lavouras (agrupadores), planos de adubação e
 * variedades. Espelha /api/rebanho/{lotes,dietas,racas}. Persistência via Prisma. */
export const plantioCadastrosRouter = new Hono()
  .get("/plantio/lavouras", async (c) => c.json(await svc.listarLavouras()))
  .get("/plantio/planos-adubacao", async (c) => c.json(await svc.listarPlanos()))
  .get("/plantio/variedades", async (c) => c.json(await svc.listarVariedades()));
