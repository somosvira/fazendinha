import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSanitarioSchema } from "../../services/rebanho/eventos-sanidade.schemas.js";
import * as svc from "../../services/rebanho/eventos-sanidade.js";
import { montarTimeline } from "../../services/rebanho/timeline.js";
import { resolverEscopoEscrita } from "../../services/propriedade.js";
import { EstoqueError } from "../../services/estoque/estoque.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.EventoSanError) return { status: e.code === "CONFLITO" || e.code === "MES_FECHADO" ? 409 : 404, body: { error: e.message } };
  // Estorno da baixa de estoque (edição/exclusão) pode esbarrar em mês fechado ou movimento já estornado.
  if (e instanceof EstoqueError) return { status: e.code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: e.message } };
  console.error("[sanidade]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const sanidadeRouter = new Hono()
  .get("/rebanho/animais/:id/timeline", async (c) => c.json(await montarTimeline(Number(c.req.param("id")))))
  .get("/rebanho/animais/:id/sanidade", async (c) => c.json(await svc.listarSanidade(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/sanidade", zValidator("json", criarEventoSanitarioSchema), async (c) => {
    try { const propriedadeId = await resolverEscopoEscrita(c); return c.json(await svc.registrarSanidade(Number(c.req.param("id")), c.req.valid("json"), propriedadeId), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .put("/rebanho/sanidade/:id", zValidator("json", criarEventoSanitarioSchema), async (c) => {
    try { const propriedadeId = await resolverEscopoEscrita(c); return c.json(await svc.editarSanidade(Number(c.req.param("id")), c.req.valid("json"), propriedadeId)); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/sanidade/:id", async (c) => {
    try { const propriedadeId = await resolverEscopoEscrita(c); await svc.excluirSanidade(Number(c.req.param("id")), propriedadeId); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
