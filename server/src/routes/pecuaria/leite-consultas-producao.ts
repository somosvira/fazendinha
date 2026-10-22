import { Hono, type Context } from "hono";
import { exigeArea, exigePermissao } from "../../middleware/permissao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { consultarProducaoLeite, consultaProducaoLeiteSchema } from "../../services/pecuaria/leite/consultas-producao.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4 } from "./reproducao.js";
async function consultar(c: Context, exportacao = false) {
  const filtro = consultaProducaoLeiteSchema.safeParse(c.req.query());
  if (!filtro.success) return c.json({ error: filtro.error.issues[0].message, code: "VALIDACAO" }, 422);
  try {
    const sitio = await resolverEscopoLeitura(c);
    if (sitio === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar a produção");
    return c.json(await consultarProducaoLeite(sitio, filtro.data, exportacao));
  } catch (erro) { return falhaV4(c, erro); }
}
export const leiteConsultasProducaoRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/", c => consultar(c))
  .get("/exportacao", exigePermissao("exportar"), c => consultar(c, true));
