import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSchema } from "../../services/rebanho/eventos.schemas.js";
import * as svc from "../../services/rebanho/eventos.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.EventoError) return { status: 404, body: { error: e.message } };
  console.error("[eventos]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const eventosRouter = new Hono()
  .get("/rebanho/animais/:id/eventos", async (c) => c.json(await svc.listarEventos(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/eventos", zValidator("json", criarEventoSchema), async (c) => {
    try { return c.json(await svc.registrarEvento(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/eventos/:id", async (c) => {
    try { await svc.excluirEvento(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
