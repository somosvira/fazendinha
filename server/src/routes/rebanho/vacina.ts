import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { agendarVacinaSchema, marcarAplicadaSchema } from "../../services/rebanho/vacina.schemas.js";
import * as svc from "../../services/rebanho/vacina.js";
import { resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.VacinaError) return { status: 404, body: { error: e.message } };
  console.error("[vacina]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const vacinaRouter = new Hono()
  .get("/rebanho/animais/:id/vacinas", async (c) => c.json(await svc.listarVacinas(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/vacinas", zValidator("json", agendarVacinaSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.agendarVacina(Number(c.req.param("id")), c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/vacinas/:id/aplicada", zValidator("json", marcarAplicadaSchema), async (c) => {
    try { return c.json(await svc.marcarAplicada(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/vacinas/:id", async (c) => {
    try { await svc.excluirVacina(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
