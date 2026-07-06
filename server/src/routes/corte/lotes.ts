import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarLoteSchema, editarLoteSchema, baixaLoteSchema, listFiltrosSchema } from "../../services/corte/lotes.schemas.js";
import { criarPesagemSchema } from "../../services/corte/pesagens.js";
import * as svc from "../../services/corte/lotes.js";
import * as pesagens from "../../services/corte/pesagens.js";
import { listarPiquetes } from "../../services/corte/piquetes.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.LoteError) {
    const map = { NAO_ENCONTRADO: 404, CODIGO_DUPLICADO: 409, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[corte/lotes]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ex.: /lotes/abc) → 404 antes de chamar o Prisma (que jogaria 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/* Rotas de Lote (gado de corte) — espelham /api/plantio/talhoes. Prisma. */
export const corteLotesRouter = new Hono()
  .get("/corte/lotes", zValidator("query", listFiltrosSchema), async (c) => c.json(await svc.listarLotes(c.req.valid("query"), await resolverEscopoLeitura(c))))
  .get("/corte/piquetes", async (c) => c.json(await listarPiquetes(await resolverEscopoLeitura(c))))
  .get("/corte/lotes/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterLote(id);
    return dto ? c.json(dto) : c.json({ error: "lote não encontrado" }, 404);
  })
  .post("/corte/lotes", zValidator("json", criarLoteSchema), async (c) => {
    try { return c.json(await svc.criarLote(c.req.valid("json"), await resolverEscopoEscrita(c)), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/corte/lotes/:id", zValidator("json", editarLoteSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarLote(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/corte/lotes/:id/baixa", zValidator("json", baixaLoteSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.darBaixa(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .get("/corte/lotes/:id/pesagens", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await pesagens.listarPesagens(id));
  })
  .post("/corte/lotes/:id/pesagens", zValidator("json", criarPesagemSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await pesagens.criarPesagem(id, c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
