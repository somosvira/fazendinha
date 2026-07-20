import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarCentralSchema, criarReprodutorSchema, atualizarReprodutorSchema } from "../../services/rebanho/reprodutores.schemas.js";
import * as svc from "../../services/rebanho/reprodutores.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.ReprodutorError) return { status: 404, body: { error: e.message } };
  console.error("[reprodutores]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Biblioteca de reprodutores (touros) + centrais de sêmen + índices genéticos.
export const reprodutoresRouter = new Hono()
  // Centrais de sêmen
  .get("/rebanho/centrais-semen", async (c) => c.json(await svc.listarCentrais(await resolverEscopoLeitura(c))))
  .post("/rebanho/centrais-semen", zValidator("json", criarCentralSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.criarCentral(c.req.valid("json"), propriedadeId), 201);
  })
  .delete("/rebanho/centrais-semen/:id", async (c) => {
    try { await svc.excluirCentral(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  // Reprodutores
  .get("/rebanho/reprodutores", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const incluirInativos = c.req.query("inativos") === "1";
    return c.json(await svc.listarReprodutores(propriedadeId, incluirInativos));
  })
  .post("/rebanho/reprodutores", zValidator("json", criarReprodutorSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.criarReprodutor(c.req.valid("json"), propriedadeId), 201);
  })
  .patch("/rebanho/reprodutores/:id", zValidator("json", atualizarReprodutorSchema), async (c) => {
    try { return c.json(await svc.atualizarReprodutor(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/reprodutores/:id", async (c) => {
    try { await svc.excluirReprodutor(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
