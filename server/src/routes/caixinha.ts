// Rotas da Caixinha (fundo fixo em dinheiro) — padrão de routes/cultivo/silos.ts:
// Hono chained + zValidator, parseId NaN→404, enums UPPERCASE.
// Mês fechado (FechamentoMensal) → 409 com mensagem PT-BR.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  criarCaixinhaSchema,
  editarCaixinhaSchema,
  criarMovimentoCaixinhaSchema,
  listMovimentoCaixinhaFiltrosSchema,
} from "../services/caixinha/schemas.js";
import * as svc from "../services/caixinha/caixinhas.js";
import { FechamentoMensalError } from "../services/fechamento.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../services/propriedade.js";

function handle(err: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (err instanceof svc.CaixinhaError) {
    return { status: 404, body: { error: err.message } };
  }
  if (err instanceof FechamentoMensalError) {
    return { status: 409, body: { error: err.message } };
  }
  console.error("[caixinha]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const caixinhaRouter = new Hono()
  .get("/caixinhas", async (c) => c.json(await svc.listarCaixinhas(await resolverEscopoLeitura(c))))
  .post("/caixinhas", zValidator("json", criarCaixinhaSchema), async (c) => {
    try { return c.json(await svc.criarCaixinha(c.req.valid("json"), await resolverEscopoEscrita(c)), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/caixinhas/:id", zValidator("json", editarCaixinhaSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarCaixinha(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .get("/caixinhas/:id/movimentos", zValidator("query", listMovimentoCaixinhaFiltrosSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.listarMovimentosCaixinha(id, c.req.valid("query"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/caixinhas/:id/movimentos", zValidator("json", criarMovimentoCaixinhaSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.criarMovimentoCaixinha(id, c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/caixinhas/:id/movimentos/:movimentoId", async (c) => {
    const id = parseId(c.req.param("id"));
    const movimentoId = parseId(c.req.param("movimentoId"));
    if (id == null || movimentoId == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirMovimentoCaixinha(id, movimentoId); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
