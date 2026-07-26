import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSchema } from "../../services/rebanho/eventos.schemas.js";
import * as svc from "../../services/rebanho/eventos.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.EventoError) return { status: 404, body: { error: e.message } };
  if (e instanceof svc.ConflitoLactacaoError) return { status: 409, body: { error: e.message } };
  console.error("[eventos]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const eventosRouter = new Hono()
  .get("/rebanho/reproducao/taxa-concepcao", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await svc.taxaConcepcaoRebanho(propriedadeId));
  })
  .get("/rebanho/animais/:id/eventos", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.listarEventos(Number(c.req.param("id")), propriedadeId));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/animais/:id/eventos", zValidator("json", criarEventoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.registrarEvento(Number(c.req.param("id")), c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/eventos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirEvento(Number(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
