import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { dietaSchema, loteSchema } from "../../services/rebanho/nutricao.js";
import * as svc from "../../services/rebanho/nutricao.js";

const err = (e: unknown) => e instanceof svc.NutricaoError ? ({ NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409, EM_USO: 409 } as const)[e.code] : 500;

export const nutricaoRouter = new Hono()
  .get("/rebanho/dietas", async (c) => c.json(await svc.listarDietas()))
  .post("/rebanho/dietas", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.criarDieta(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/dietas/:id", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.editarDieta(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .delete("/rebanho/dietas/:id", async (c) => { try { await svc.excluirDieta(Number(c.req.param("id"))); return c.json({ ok: true }); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .get("/rebanho/lotes", async (c) => c.json(await svc.listarLotes()))
  .get("/rebanho/lotes/:id", async (c) => { try { return c.json(await svc.obterLote(Number(c.req.param("id")))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .post("/rebanho/lotes", zValidator("json", loteSchema), async (c) => { try { return c.json(await svc.criarLote(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/lotes/:id", zValidator("json", loteSchema), async (c) => { try { return c.json(await svc.editarLote(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .delete("/rebanho/lotes/:id", async (c) => { try { await svc.excluirLote(Number(c.req.param("id"))); return c.json({ ok: true }); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .post("/rebanho/lotes/:id/dieta", zValidator("json", z.object({ dietaId: z.number().int().nullable() })), async (c) => { try { await svc.atribuirDieta(Number(c.req.param("id")), c.req.valid("json").dietaId); return c.json({ ok: true }); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .get("/rebanho/animais-disponiveis", async (c) => c.json(await svc.listarAnimaisDisponiveis()));
