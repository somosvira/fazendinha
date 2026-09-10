import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarPrincipioSchema, atualizarPrincipioSchema, definirComposicaoSchema } from "../../services/rebanho/principio-ativo.schemas.js";
import * as svc from "../../services/rebanho/principio-ativo.js";
import { parseEntityId } from "../../lib/ids.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.PrincipioError) return { status: e.code === "NOME_DUPLICADO" ? 409 : 404, body: { error: e.message } };
  console.error("[principio-ativo]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Princípios ativos (catálogo) + composição de medicamentos (base carência/antibiótico).
export const principioAtivoRouter = new Hono()
  .get("/rebanho/principios-ativos", async (c) => {
    const incluirInativos = c.req.query("inativos") === "1";
    return c.json(await svc.listarPrincipios(incluirInativos));
  })
  .post("/rebanho/principios-ativos", zValidator("json", criarPrincipioSchema), async (c) => {
    try { return c.json(await svc.criarPrincipio(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/principios-ativos/:id", zValidator("json", atualizarPrincipioSchema), async (c) => {
    try { return c.json(await svc.atualizarPrincipio(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/principios-ativos/:id", async (c) => {
    try { await svc.excluirPrincipio(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  // Composição de um produto (medicamento) → seus princípios ativos + flags derivadas.
  .get("/rebanho/produtos/:id/composicao", async (c) => {
    try { return c.json(await svc.obterComposicao(parseEntityId(c.req.param("id")))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .put("/rebanho/produtos/:id/composicao", zValidator("json", definirComposicaoSchema), async (c) => {
    try { return c.json(await svc.definirComposicao(parseEntityId(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
