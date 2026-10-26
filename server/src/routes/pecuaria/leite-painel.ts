import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { exigeArea } from "../../middleware/permissao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { consultarPainelLeite } from "../../services/pecuaria/leite/painel.js";
import { consultaCustosLeiteSchema } from "../../services/pecuaria/leite/custos.schemas.js";
import { falhaV4 } from "./reproducao.js";
export const leitePainelRouter = new Hono().use("*", exigeArea("pecuaria")).get(
  "/",
  zValidator("query", consultaCustosLeiteSchema, (r, c) =>
    !r.success
      ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422)
      : undefined,
  ),
  async (c) => {
    try {
      const { inicio, fim } = c.req.valid("query");
      return c.json(
        await consultarPainelLeite(await resolverEscopoLeitura(c), inicio, fim),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
