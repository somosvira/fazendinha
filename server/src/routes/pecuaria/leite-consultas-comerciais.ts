import { Hono, type Context } from "hono";
import { exigeArea, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { consultaComercialLeiteSchema } from "../../services/pecuaria/leite/comercial.schemas.js";
import { consultaColetasOperacoesLeiteSchema, consultarColetasOperacoesLeite, consultarVendasOperacoesLeite } from "../../services/pecuaria/leite/comercial.consultas-operacionais.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4 } from "./reproducao.js";
async function consultar(c: Context, tipo: "coletas" | "vendas") {
  const filtro = (tipo === "coletas" ? consultaColetasOperacoesLeiteSchema : consultaComercialLeiteSchema).safeParse(c.req.query());
  if (!filtro.success) return c.json({ error: filtro.error.issues[0].message, code: "VALIDACAO" }, 422);
  try {
    const sitio = await resolverEscopoLeitura(c);
    if (sitio === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar leite");
    return c.json(tipo === "coletas" ? await consultarColetasOperacoesLeite(sitio, filtro.data) : await consultarVendasOperacoesLeite(sitio, filtro.data, podeVerValoresFinanceiros(getUsuario(c))));
  } catch (erro) { return falhaV4(c, erro); }
}
export const leiteConsultasComerciaisRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/coletas", c => consultar(c, "coletas"))
  .get("/vendas", c => consultar(c, "vendas"));
