import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { controleSchema, producaoLoteSchema } from "../../services/rebanho/producao.schemas.js";
import * as svc from "../../services/rebanho/producao.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.ProducaoError) return { status: 404, body: { error: e.message } };
  console.error("[producao]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const producaoRouter = new Hono()
  .get("/rebanho/producao", async (c) => c.json(await svc.agregarProducao()))
  .post("/rebanho/animais/:id/producao", zValidator("json", controleSchema), async (c) => {
    try { return c.json(await svc.registrarControle(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/producao/:id", async (c) => {
    try { await svc.excluirControle(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/producao-lote", zValidator("json", producaoLoteSchema), async (c) => {
    try { return c.json(await svc.registrarProducaoLote(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/producao-lote/:id", async (c) => {
    try { await svc.excluirProducaoLote(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
