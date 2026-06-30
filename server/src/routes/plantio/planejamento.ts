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

// :id de rota não numérico → 404 antes do Prisma (evita 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Filtro ?safraId — distingue "ausente" (→ undefined, lista tudo) de "presente mas
// inválido" (?safraId=abc → "NAN", para o handler curto-circuitar em []).
function parseSafraIdFiltro(q?: string): number | undefined | "NAN" {
  if (q == null || q === "") return undefined; // ausente → sem filtro (lista tudo)
  const id = Number(q);
  return Number.isInteger(id) && id > 0 ? id : "NAN";
}

/* Camada operacional Ideagri — Safra / Tarefas (planejado×realizado) / Apontamentos. */
export const plantioPlanejamentoRouter = new Hono()
  // ── Safras ──
  .get("/plantio/safras", async (c) => c.json(await svc.listarSafras()))
  .post("/plantio/safras", zValidator("json", criarSafraSchema), async (c) => {
    try { return c.json(await svc.criarSafra(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/plantio/safras/:id", zValidator("json", editarSafraSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarSafra(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  // ── Tarefas ──
  .get("/plantio/tarefas", async (c) => {
    const f = parseSafraIdFiltro(c.req.query("safraId"));
    if (f === "NAN") return c.json([]); // safraId presente e inválido → vazio (não "lista tudo")
    return c.json(await svc.listarTarefas(f));
  })
  .post("/plantio/tarefas", zValidator("json", criarTarefaSchema), async (c) => {
    try { return c.json(await svc.criarTarefa(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/plantio/tarefas/:id", zValidator("json", editarTarefaSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarTarefa(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/plantio/tarefas/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirTarefa(id); return c.json({ ok: true }); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  // ── Apontamentos ──
  .get("/plantio/apontamentos", async (c) => {
    const f = parseSafraIdFiltro(c.req.query("safraId"));
    if (f === "NAN") return c.json([]); // safraId presente e inválido → vazio
    return c.json(await svc.listarApontamentos(f));
  })
  .post("/plantio/apontamentos", zValidator("json", criarApontamentoSchema), async (c) => {
    try { return c.json(await svc.criarApontamento(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/plantio/apontamentos/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirApontamento(id); return c.json({ ok: true }); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
