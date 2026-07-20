import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { registrarExameQuartoSchema } from "../../services/rebanho/exames-quarto.schemas.js";
import * as svc from "../../services/rebanho/exames-quarto.js";

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.ExameQuartoError) return { status: 404, body: { error: e.message } };
  console.error("[exames-quarto]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const examesQuartoRouter = new Hono()
  .get("/rebanho/animais/:id/exames-quarto", async (c) => {
    try { return c.json(await svc.listarSaudeUbere(Number(c.req.param("id")))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/animais/:id/exames-quarto", zValidator("json", registrarExameQuartoSchema), async (c) => {
    try { return c.json(await svc.registrarExameQuarto(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
