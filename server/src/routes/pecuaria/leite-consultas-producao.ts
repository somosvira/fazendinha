import { Hono, type Context } from "hono";
import { exigeArea, exigePermissao } from "../../middleware/permissao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { consultarProducaoLeite, consultaProducaoLeiteSchema } from "../../services/pecuaria/leite/consultas-producao.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4 } from "./reproducao.js";
import { consultarResumoOperacionalProducaoLeite, consultaResumoOperacionalProducaoSchema } from "../../services/pecuaria/leite/resumo-operacional-producao.js";
async function consultar(c: Context, exportacao = false) {
  const filtro = consultaProducaoLeiteSchema.safeParse(c.req.query());
  if (!filtro.success) return c.json({ error: filtro.error.issues[0].message, code: "VALIDACAO" }, 422);
  try {
    // null = Consolidado: a consulta soma os sítios ativos.
    return c.json(await consultarProducaoLeite(await resolverEscopoLeitura(c), filtro.data, exportacao));
  } catch (erro) { return falhaV4(c, erro); }
}
export const leiteConsultasProducaoRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/resumo-operacional", async c => {
    const filtro = consultaResumoOperacionalProducaoSchema.safeParse(c.req.query());
    if (!filtro.success) return c.json({ error: filtro.error.issues[0].message, code: "VALIDACAO" }, 422);
    try {
      // null = Consolidado: soma consumo, descarte e vendas dos sítios ativos.
      return c.json(await consultarResumoOperacionalProducaoLeite(await resolverEscopoLeitura(c), filtro.data));
    } catch (erro) { return falhaV4(c, erro); }
  })
  .get("/", c => consultar(c))
  .get("/exportacao", exigePermissao("exportar"), c => consultar(c, true));
