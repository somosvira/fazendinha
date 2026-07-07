import { Hono } from "hono";
import * as svc from "../../services/plantio/cadastros.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

/* Cadastros do Plantio — lavouras (agrupadores), planos de adubação e
 * variedades. Espelha /api/rebanho/{lotes,dietas,racas}. Persistência via Prisma.
 * Só lavoura escopa por sítio; planos e variedades são cadastros compartilhados
 * (espelham Dieta/Raca do rebanho, que também não escopam). */
export const plantioCadastrosRouter = new Hono()
  .get("/plantio/lavouras", async (c) => c.json(await svc.listarLavouras(await resolverEscopoLeitura(c))))
  .get("/plantio/planos-adubacao", async (c) => c.json(await svc.listarPlanos()))
  .get("/plantio/variedades", async (c) => c.json(await svc.listarVariedades()));
