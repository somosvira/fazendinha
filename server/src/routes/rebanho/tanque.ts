import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarTanqueSchema, registrarAnaliseTanqueSchema } from "../../services/rebanho/tanque.schemas.js";
import * as svc from "../../services/rebanho/tanque.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.TanqueError) return { status: 404, body: { error: e.message } };
  console.error("[tanque]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Tanques de resfriamento + análise de tanque (qualidade do leite bulk).
export const tanqueRouter = new Hono()
  .get("/rebanho/tanques", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await svc.listarTanques(propriedadeId));
  })
  .post("/rebanho/tanques", zValidator("json", criarTanqueSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.criarTanque(c.req.valid("json"), propriedadeId), 201);
  })
  .delete("/rebanho/tanques/:id", async (c) => {
    try { await svc.excluirTanque(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/tanques/:id/analises", async (c) => c.json(await svc.listarAnalises(Number(c.req.param("id")))))
  .post("/rebanho/tanques/:id/analises", zValidator("json", registrarAnaliseTanqueSchema), async (c) => {
    try { return c.json(await svc.registrarAnalise(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
