import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarProgramacaoSchema, executarEtapaLoteSchema } from "../../services/rebanho/iatf-lote.schemas.js";
import * as svc from "../../services/rebanho/iatf-lote.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.IatfLoteError) return { status: e.code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: e.message } };
  console.error("[iatf-lote]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Programação de IATF por lote — aplica um protocolo a um conjunto de animais num mesmo D0.
export const iatfLoteRouter = new Hono()
  .get("/rebanho/iatf/programacoes", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await svc.listarProgramacoes(propriedadeId));
  })
  .post("/rebanho/iatf/programacoes", zValidator("json", criarProgramacaoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.criarProgramacao(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/iatf/programacoes/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.detalheProgramacao(Number(c.req.param("id")), propriedadeId));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/iatf/programacoes/:id/execucoes", zValidator("json", executarEtapaLoteSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.executarEtapaLote(
        Number(c.req.param("id")),
        c.req.valid("json"),
        propriedadeId,
      ));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/iatf/programacoes/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirProgramacao(Number(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
