import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  criarSafraSchema, editarSafraSchema,
  criarTarefaSchema, editarTarefaSchema,
  criarApontamentoSchema,
} from "../../services/plantio/planejamento.schemas.js";
import * as svc from "../../services/plantio/planejamento.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.PlanejamentoError) {
    const map = { NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[plantio/planejamento]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const toId = (q?: string) => (q ? Number(q) : undefined);

/* Camada operacional Ideagri — Safra / Tarefas (planejado×realizado) / Apontamentos. */
export const plantioPlanejamentoRouter = new Hono()
  // ── Safras ──
  .get("/plantio/safras", async (c) => c.json(await svc.listarSafras()))
  .post("/plantio/safras", zValidator("json", criarSafraSchema), async (c) => {
    try { return c.json(await svc.criarSafra(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/plantio/safras/:id", zValidator("json", editarSafraSchema), async (c) => {
    try { return c.json(await svc.editarSafra(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  // ── Tarefas ──
  .get("/plantio/tarefas", async (c) => c.json(await svc.listarTarefas(toId(c.req.query("safraId")))))
  .post("/plantio/tarefas", zValidator("json", criarTarefaSchema), async (c) => {
    try { return c.json(await svc.criarTarefa(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/plantio/tarefas/:id", zValidator("json", editarTarefaSchema), async (c) => {
    try { return c.json(await svc.editarTarefa(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/plantio/tarefas/:id", async (c) => {
    try { await svc.excluirTarefa(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  // ── Apontamentos ──
  .get("/plantio/apontamentos", async (c) => c.json(await svc.listarApontamentos(toId(c.req.query("safraId")))))
  .post("/plantio/apontamentos", zValidator("json", criarApontamentoSchema), async (c) => {
    try { return c.json(await svc.criarApontamento(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/plantio/apontamentos/:id", async (c) => {
    try { await svc.excluirApontamento(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
