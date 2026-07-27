import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  ajustarDosesSchema,
  criarLoteSchema,
  criarTipoSemenSchema,
} from "../../services/rebanho/semen.schemas.js";
import * as svc from "../../services/rebanho/semen.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.SemenError) {
    return { status: e.code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: e.message } };
  }
  console.error("[semen]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

function idPositivo(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const semenRouter = new Hono()
  .get("/rebanho/semen/tipos", async (c) => c.json(await svc.listarTiposSemen()))
  .post("/rebanho/semen/tipos", zValidator("json", criarTipoSemenSchema), async (c) => {
    try {
      return c.json(await svc.criarTipoSemen(c.req.valid("json")), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/reprodutores/:id/semen", async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.SemenError("NAO_ENCONTRADO", "reprodutor não encontrado");
      return c.json(await svc.listarEstoqueSemen(id, await resolverEscopoLeitura(c)));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/reprodutores/:id/semen", zValidator("json", criarLoteSchema), async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.SemenError("NAO_ENCONTRADO", "reprodutor não encontrado");
      return c.json(await svc.criarLoteSemen(
        id,
        c.req.valid("json"),
        await resolverEscopoEscrita(c),
      ), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/semen/:id/doses", zValidator("json", ajustarDosesSchema), async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.SemenError("NAO_ENCONTRADO", "estoque de sêmen não encontrado");
      return c.json(await svc.ajustarDoses(
        id,
        c.req.valid("json"),
        await resolverEscopoEscrita(c),
      ));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
