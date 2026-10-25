import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { exigeArea, exigePermissao } from "../../middleware/permissao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { preverHistoricoLeite } from "../../services/pecuaria/leite/previa.js";
import { previaHistoricaLeiteSchema } from "../../services/pecuaria/leite/previa.schemas.js";
import { falhaV4 } from "./reproducao.js";
export const leitePreviaRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .post(
    "/previa-historica",
    exigePermissao("lancar"),
    zValidator("json", previaHistoricaLeiteSchema, (r, c) =>
      !r.success
        ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422)
        : undefined,
    ),
    async (c) => {
      try {
        const sitio = await resolverEscopoLeitura(c);
        if (sitio === null)
          throw new RebanhoError(
            "VALIDACAO",
            "Selecione o sítio para conferir o lote histórico",
          );
        return c.json(await preverHistoricoLeite(sitio, c.req.valid("json")));
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  );
