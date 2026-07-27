import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  atualizarIndicadorSchema,
  criarDicionarioSchema,
  criarIndicadorSchema,
  salvarFichaSchema,
} from "../../services/rebanho/genetica.schemas.js";
import * as svc from "../../services/rebanho/genetica.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.GeneticaError) {
    return { status: e.code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: e.message } };
  }
  console.error("[genetica]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

function idPositivo(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const geneticaRouter = new Hono()
  .get("/rebanho/genetica/indicadores", async (c) => c.json(await svc.listarIndicadores()))
  .post("/rebanho/genetica/indicadores", zValidator("json", criarIndicadorSchema), async (c) => {
    try {
      return c.json(await svc.criarIndicador(c.req.valid("json")), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/genetica/indicadores/:id", zValidator("json", atualizarIndicadorSchema), async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.GeneticaError("NAO_ENCONTRADO", "indicador não encontrado");
      return c.json(await svc.atualizarIndicador(id, c.req.valid("json")));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/genetica/indicadores/:id", async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.GeneticaError("NAO_ENCONTRADO", "indicador não encontrado");
      await svc.excluirIndicador(id);
      return c.json({ ok: true });
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/genetica/marcadores", async (c) => c.json(await svc.listarMarcadores()))
  .post("/rebanho/genetica/marcadores", zValidator("json", criarDicionarioSchema), async (c) => {
    try {
      return c.json(await svc.criarMarcador(c.req.valid("json")), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/genetica/caseinas", async (c) => c.json(await svc.listarCaseinas()))
  .post("/rebanho/genetica/caseinas", zValidator("json", criarDicionarioSchema), async (c) => {
    try {
      return c.json(await svc.criarCaseina(c.req.valid("json")), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/reprodutores/:id/genetica", async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.GeneticaError("NAO_ENCONTRADO", "reprodutor não encontrado");
      return c.json(await svc.obterFichaGenetica(id, await resolverEscopoLeitura(c)));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .put("/rebanho/reprodutores/:id/genetica", zValidator("json", salvarFichaSchema), async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.GeneticaError("NAO_ENCONTRADO", "reprodutor não encontrado");
      return c.json(await svc.salvarFichaGenetica(id, c.req.valid("json"), await resolverEscopoEscrita(c)));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/reprodutores/ranking", async (c) => {
    try {
      const raw = c.req.query("indicadorId");
      const indicadorId = raw == null || raw === "" ? null : idPositivo(raw);
      if (raw != null && raw !== "" && indicadorId == null) {
        throw new svc.GeneticaError("NAO_ENCONTRADO", "indicador não encontrado");
      }
      return c.json(await svc.rankingReprodutores(indicadorId, await resolverEscopoLeitura(c)));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
