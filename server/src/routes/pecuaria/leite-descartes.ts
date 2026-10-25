import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoLeitura, resolverEscopoEscrita, PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { ValorizacaoError } from "../../services/estoque/valorizacao.calc.js";
import { descarteLeiteSchema, estornoDescarteLeiteSchema, consultaDescartesLeiteSchema } from "../../services/pecuaria/leite/descartes.schemas.js";
import * as descartes from "../../services/pecuaria/leite/descartes.js";
const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
async function sitio(c: Context) { const id = await resolverEscopoLeitura(c); if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar descartes"); return id; }
function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof ValorizacaoError || erro instanceof FinanceiroError) return c.json({ error: erro.message, code: erro.code }, erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof PropriedadeError || erro instanceof z.ZodError) return c.json({ error: erro.message, code: "VALIDACAO" }, 422);
  if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(erro.code)) return c.json({ error: "O descarte ou sua origem mudou; recarregue os dados", code: "CONFLITO" }, 409);
  console.error("[pecuaria/leite/descartes]", erro); return c.json({ error: "Não foi possível processar o descarte" }, 500);
}
const autor = (c: Context) => { const id = getUsuario(c)?.id; return id != null && id > 0 ? id : null; };
export const leiteDescartesRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/descartes", async c => { try { return c.json(await descartes.listarDescartesLeite(await sitio(c), consultaDescartesLeiteSchema.parse(c.req.query()))); } catch (e) { return falha(c, e); } })
  .get("/descartes/:id", async c => { try { return c.json(await descartes.obterDescarteLeite(z.string().uuid().parse(c.req.param("id")), await sitio(c))); } catch (e) { return falha(c, e); } })
  .post("/descartes", exigePermissao("lancar"), validar(descarteLeiteSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await descartes.registrarDescarteLeite({ ...input, propriedadeId }, autor(c)), 201); } catch (e) { return falha(c, e); }
  })
  .post("/descartes/:id/estorno", exigePermissao("lancar"), validar(estornoDescarteLeiteSchema), async c => {
    try { const id = z.string().uuid().parse(c.req.param("id")), input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await descartes.estornarDescarteLeite(id, { ...input, propriedadeId }, autor(c))); } catch (e) { return falha(c, e); }
  });
