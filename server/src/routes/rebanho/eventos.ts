import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSchema } from "../../services/rebanho/eventos.schemas.js";
import * as svc from "../../services/rebanho/eventos.js";

export const eventosRouter = new Hono()
  .get("/rebanho/animais/:id/eventos", async (c) => c.json(await svc.listarEventos(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/eventos", zValidator("json", criarEventoSchema), async (c) => {
    try { return c.json(await svc.registrarEvento(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.EventoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/eventos/:id", async (c) => {
    try { await svc.excluirEvento(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.EventoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  });
