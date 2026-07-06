import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as svc from "../services/propriedade.js";
import { propriedadeSchema } from "../services/propriedade.js";

type Status = 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.PropriedadeError) {
    const map = { NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[propriedade]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Multi-propriedade (Fatia 1): lista + cadastro dos sítios. O front só mostra o
// seletor quando há ≥2 — com 1 propriedade a camada fica invisível.
export const propriedadeRouter = new Hono()
  .get("/propriedades", async (c) => c.json(await svc.listarPropriedades()))
  .post("/propriedades", zValidator("json", propriedadeSchema), async (c) => { try { return c.json(await svc.criarPropriedade(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/propriedades/:id", zValidator("json", propriedadeSchema), async (c) => { try { return c.json(await svc.editarPropriedade(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
