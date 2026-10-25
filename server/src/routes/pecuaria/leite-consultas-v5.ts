import { Hono, type Context } from "hono";
import { exigeArea, getUsuario } from "../../middleware/permissao.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { consultarOrdenhasPeriodo, consultaOrdenhasPeriodoSchema } from "../../services/pecuaria/leite/consultas-ordenhas.js";
import { consultarResumoEstoqueLeite, consultaResumoEstoqueLeiteSchema } from "../../services/pecuaria/leite/resumo-estoque.js";
import { consultarVendasUnificadasLeite, consultaVendasUnificadasLeiteSchema } from "../../services/pecuaria/leite/vendas-unificadas.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { falhaV4 } from "./reproducao.js";
async function sitio(c: Context) {
  const id = await resolverEscopoLeitura(c);
  if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar o leite");
  return id;
}
/** Montar no prefixo /api/pecuaria/rebanho/leite, antes das rotas com identidade. */
export const leiteConsultasV5Router = new Hono().use("*", exigeArea("pecuaria"))
  .get("/geral/consulta", async c => {
    const filtro = consultaOrdenhasPeriodoSchema.safeParse(c.req.query());
    if (!filtro.success) return c.json({ code: "VALIDACAO", error: filtro.error.issues[0].message }, 422);
    try { return c.json(await consultarOrdenhasPeriodo(await sitio(c), filtro.data)); } catch (e) { return falhaV4(c, e); }
  })
  .get("/comercial/vendas-unificadas", async c => {
    const filtro = consultaVendasUnificadasLeiteSchema.safeParse(c.req.query());
    if (!filtro.success) return c.json({ code: "VALIDACAO", error: filtro.error.issues[0].message }, 422);
    try { return c.json(await consultarVendasUnificadasLeite(await sitio(c), filtro.data, podeVerValoresFinanceiros(getUsuario(c)))); } catch (e) { return falhaV4(c, e); }
  })
  .get("/estoque/resumo", async c => {
    const filtro = consultaResumoEstoqueLeiteSchema.safeParse(c.req.query());
    if (!filtro.success) return c.json({ code: "VALIDACAO", error: filtro.error.issues[0].message }, 422);
    try { return c.json(await consultarResumoEstoqueLeite(await sitio(c), filtro.data, podeVerValoresFinanceiros(getUsuario(c)))); } catch (e) { return falhaV4(c, e); }
  });
