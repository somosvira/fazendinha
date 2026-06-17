import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSanitarioSchema } from "../../services/rebanho/eventos-sanidade.schemas.js";
import * as svc from "../../services/rebanho/eventos-sanidade.js";
import { montarTimeline } from "../../services/rebanho/timeline.js";

export const sanidadeRouter = new Hono()
  .get("/rebanho/animais/:id/timeline", async (c) => c.json(await montarTimeline(Number(c.req.param("id")))))
  .get("/rebanho/animais/:id/sanidade", async (c) => c.json(await svc.listarSanidade(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/sanidade", zValidator("json", criarEventoSanitarioSchema), async (c) => {
    try { return c.json(await svc.registrarSanidade(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.EventoSanError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/sanidade/:id", async (c) => {
    try { await svc.excluirSanidade(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.EventoSanError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  });
