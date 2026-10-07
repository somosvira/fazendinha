import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoEscrita } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { EstoqueError } from "../../services/estoque/estoque.js";
import { conflitoTransacaoPecuaria } from "../../services/pecuaria/transacao.js";
import { previaExecucaoEtapasSchema, confirmarExecucaoEtapasSchema } from "../../services/pecuaria/sanidade/execucao-etapas.schemas.js";
import { preverExecucaoEtapas, confirmarExecucaoEtapas } from "../../services/pecuaria/sanidade/execucao-etapas.js";

function falha(c: Context, e: unknown) {
  if (e instanceof RebanhoError || e instanceof FinanceiroError || e instanceof EstoqueError) return c.json({ error: e.message, code: e.code, campo: e.campo }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
  if (conflitoTransacaoPecuaria(e) || (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) return c.json({ error: "Os dados mudaram. Confira uma nova prévia e tente novamente", code: "CONFLITO" }, 409);
  return c.json({ error: "Não conseguimos conferir a execução. Tente novamente" }, 500);
}

export const execucaoEtapasRouter = new Hono()
  .use("/tarefas/execucao/*", exigeArea("pecuaria"), exigePermissao("lancar"))
  .post("/tarefas/execucao/previa", zValidator("json", previaExecucaoEtapasSchema, (r, c) => {
    if (!r.success) return c.json({ error: r.error.issues[0].message, code: "VALIDACAO", campo: r.error.issues[0].path.join(".") }, 422);
  }), async (c) => {
    try { const input = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await preverExecucaoEtapas({ ...input, propriedadeId })); }
    catch (e) { return falha(c, e); }
  })
  .post("/tarefas/execucao/confirmacao", zValidator("json", confirmarExecucaoEtapasSchema, (r, c) => {
    if (!r.success) return c.json({ error: r.error.issues[0].message, code: "VALIDACAO", campo: r.error.issues[0].path.join(".") }, 422);
  }), async (c) => {
    try { const input = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await confirmarExecucaoEtapas({ ...input, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  });
