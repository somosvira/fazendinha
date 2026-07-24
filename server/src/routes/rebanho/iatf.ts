import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarProtocoloSchema, atualizarProtocoloSchema, aplicarProtocoloSchema } from "../../services/rebanho/iatf.schemas.js";
import * as svc from "../../services/rebanho/iatf.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.IatfError) return { status: e.code === "PROTOCOLO_INATIVO" ? 409 : 404, body: { error: e.message } };
  console.error("[iatf]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const iatfRouter = new Hono()
  // ── Catálogo de protocolos ─────────────────────────────────────────────────
  .get("/rebanho/iatf/protocolos", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const incluirInativos = c.req.query("inativos") === "1";
    return c.json(await svc.listarProtocolos(propriedadeId, incluirInativos));
  })
  .post("/rebanho/iatf/protocolos", zValidator("json", criarProtocoloSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.criarProtocolo(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/iatf/protocolos/:id", zValidator("json", atualizarProtocoloSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.atualizarProtocolo(Number(c.req.param("id")), c.req.valid("json"), propriedadeId));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/iatf/protocolos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirProtocolo(Number(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  // ── Aplicação a um animal ──────────────────────────────────────────────────
  .get("/rebanho/animais/:id/iatf", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.listarAplicacoes(Number(c.req.param("id")), propriedadeId));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/animais/:id/iatf", zValidator("json", aplicarProtocoloSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.aplicarProtocolo(Number(c.req.param("id")), c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/iatf/aplicacoes/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirAplicacao(Number(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
