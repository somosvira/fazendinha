import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { controleSchema, producaoLoteSchema } from "../../services/rebanho/producao.schemas.js";
import * as svc from "../../services/rebanho/producao.js";

export const producaoRouter = new Hono()
  .get("/rebanho/producao", async (c) => c.json(await svc.agregarProducao()))
  .post("/rebanho/animais/:id/producao", zValidator("json", controleSchema), async (c) => {
    try { return c.json(await svc.registrarControle(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.ProducaoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/producao/:id", async (c) => {
    try { await svc.excluirControle(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.ProducaoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .post("/rebanho/producao-lote", zValidator("json", producaoLoteSchema), async (c) => {
    try { return c.json(await svc.registrarProducaoLote(c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.ProducaoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/producao-lote/:id", async (c) => {
    try { await svc.excluirProducaoLote(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.ProducaoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  });
