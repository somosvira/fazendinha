import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";
import { aplicarAptidaoAutomaticaSchema, registrarAptidaoSchema } from "../../services/rebanho/aptidao.schemas.js";
import * as svc from "../../services/rebanho/aptidao.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.AptidaoError) return { status: 404, body: { error: e.message } };
  console.error("[aptidao]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const aptidaoRouter = new Hono()
  .get("/rebanho/animais/:id/aptidao", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.listarAptidoes(Number(c.req.param("id")), propriedadeId));
    } catch (e) {
      const { status, body } = fail(e);
      return c.json(body, status);
    }
  })
  .post("/rebanho/animais/:id/aptidao", zValidator("json", registrarAptidaoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      const registro = await svc.registrarAptidao(
        Number(c.req.param("id")),
        c.req.valid("json"),
        propriedadeId,
      );
      return c.json(registro, 201);
    } catch (e) {
      const { status, body } = fail(e);
      return c.json(body, status);
    }
  })
  .get("/rebanho/aptidao/sugestoes", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await svc.sugerirAptidaoAutomatica(propriedadeId));
  })
  .post("/rebanho/aptidao/aplicar", zValidator("json", aplicarAptidaoAutomaticaSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.aplicarAptidaoAutomatica(propriedadeId, c.req.valid("json").data));
  });
