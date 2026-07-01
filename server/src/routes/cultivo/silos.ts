import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarSiloSchema, editarSiloSchema, listSiloFiltrosSchema, criarMovimentoSiloSchema } from "../../services/cultivo/schemas.js";
import * as svc from "../../services/cultivo/silos.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.SiloError) {
    const map = { NAO_ENCONTRADO: 404, MOVIMENTO_INVALIDO: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[cultivo/silos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rotas de Silo + MovimentoSilo (razão). Movimentos manuais cobrem
// SAIDA: NUTRICAO/VENDA/AJUSTE — ENTRADA/COLHEITA só é criada pela produção.
export const cultivoSilosRouter = new Hono()
  .get("/cultivo/silos", zValidator("query", listSiloFiltrosSchema), async (c) => c.json(await svc.listarSilos(c.req.valid("query"))))
  .get("/cultivo/silos/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterSilo(id);
    return dto ? c.json(dto) : c.json({ error: "silo não encontrado" }, 404);
  })
  .post("/cultivo/silos", zValidator("json", criarSiloSchema), async (c) => {
    try { return c.json(await svc.criarSilo(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/cultivo/silos/:id", zValidator("json", editarSiloSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarSilo(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/silos/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirSilo(id); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .get("/cultivo/silos/:id/movimentos", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.listarMovimentosSilo(id)); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/cultivo/silos/:id/movimentos", zValidator("json", criarMovimentoSiloSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.criarMovimentoSilo(id, c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/silos/:id/movimentos/:movimentoId", async (c) => {
    const id = parseId(c.req.param("id"));
    const movimentoId = parseId(c.req.param("movimentoId"));
    if (id == null || movimentoId == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirMovimentoSilo(id, movimentoId); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
