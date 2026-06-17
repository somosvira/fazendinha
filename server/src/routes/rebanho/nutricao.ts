import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { dietaSchema } from "../../services/rebanho/nutricao.js";
import * as svc from "../../services/rebanho/nutricao.js";

const err = (e: unknown) => e instanceof svc.NutricaoError ? ({ NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409 } as const)[e.code] : 500;
export const nutricaoRouter = new Hono()
  .get("/rebanho/dietas", async (c) => c.json(await svc.listarDietas()))
  .post("/rebanho/dietas", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.criarDieta(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/dietas/:id", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.editarDieta(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .get("/rebanho/lotes", async (c) => c.json(await svc.listarLotes()))
  .post("/rebanho/lotes/:id/dieta", zValidator("json", z.object({ dietaId: z.number().int().nullable() })), async (c) => { try { await svc.atribuirDieta(Number(c.req.param("id")), c.req.valid("json").dietaId); return c.json({ ok: true }); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } });
