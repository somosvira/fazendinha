import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { PropriedadeError, resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { ValorizacaoError } from "../../services/estoque/valorizacao.calc.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import * as destinos from "../../services/pecuaria/leite/destinos.js";
import { consultaDestinatariosLeiteSchema, consultaDestinosLeiteSchema, consultaOrigensDestinoSchema, destinoInternoLeiteSchema, estornoDestinoLeiteSchema } from "../../services/pecuaria/leite/destinos.schemas.js";
const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
const query = <T extends z.ZodTypeAny>(schema: T) => zValidator("query", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
const autor = (c: Context) => { const id = getUsuario(c)?.id; return id != null && id > 0 ? id : null; };
async function sitio(c: Context) {
  const id = await resolverEscopoLeitura(c);
  if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar os destinos do leite");
  return id;
}
function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) return c.json({ error: erro.message, code: erro.code, campo: erro.campo }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof ValorizacaoError || erro instanceof FinanceiroError) return c.json({ error: erro.message, code: erro.code }, erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof PropriedadeError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : 422);
  if (erro instanceof z.ZodError) return c.json({ error: erro.issues[0].message, code: "VALIDACAO" }, 422);
  if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2025", "P2003"].includes(erro.code))
    return c.json({ error: "O destino ou sua origem mudou; recarregue antes de confirmar", code: "CONFLITO" }, 409);
  console.error("[pecuaria/leite/destinos]", erro);
  return c.json({ error: "Erro inesperado ao processar o destino interno do leite" }, 500);
}
export const leiteDestinosRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get("/destinos/crias", query(consultaDestinatariosLeiteSchema), async c => {
    try { const { data, busca, pagina } = c.req.valid("query"); return c.json(await destinos.listarCriasDestino(await sitio(c), data, busca, pagina)); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/destinos/candidatos", query(consultaDestinatariosLeiteSchema), async c => {
    try { const { data, busca, pagina } = c.req.valid("query"); return c.json(await destinos.listarDestinatarios(await sitio(c), data, busca, pagina)); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/destinos/origens", query(consultaOrigensDestinoSchema), async c => {
    try { const { produtoId, data } = c.req.valid("query"); return c.json(await destinos.listarOrigensDestino(await sitio(c), produtoId, data)); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/destinos", query(consultaDestinosLeiteSchema), async c => {
    try { return c.json(await destinos.listarDestinos(await sitio(c), c.req.valid("query"))); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/destinos/:id", async c => {
    try { const id = z.string().uuid().parse(c.req.param("id")); return c.json(await destinos.consultarDestino(id, await sitio(c))); }
    catch (erro) { return falha(c, erro); }
  })
  .post("/destinos", exigePermissao("lancar"), validar(destinoInternoLeiteSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(await destinos.registrarDestinoInterno({ ...input, propriedadeId }, autor(c)), 201); }
    catch (erro) { return falha(c, erro); }
  })
  .post("/destinos/:id/estorno", exigePermissao("lancar"), validar(estornoDestinoLeiteSchema), async c => {
    try { const id = z.string().uuid().parse(c.req.param("id")), input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(await destinos.estornarDestinoInterno(id, { ...input, propriedadeId }, autor(c))); }
    catch (erro) { return falha(c, erro); }
  });
