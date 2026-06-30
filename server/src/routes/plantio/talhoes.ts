import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarTalhaoSchema, editarTalhaoSchema, baixaSchema, listFiltrosSchema } from "../../services/plantio/schemas.js";
import * as svc from "../../services/plantio/talhoes.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.TalhaoError) {
    const map = { NAO_ENCONTRADO: 404, CODIGO_DUPLICADO: 409, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[plantio/talhoes]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ex.: /talhoes/abc) → 404 antes de chamar o Prisma (que jogaria 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/* Rotas de Talhão — espelham /api/rebanho/animais. Persistência via Prisma. */
export const plantioTalhoesRouter = new Hono()
  .get("/plantio/talhoes", zValidator("query", listFiltrosSchema), async (c) => c.json(await svc.listarTalhoes(c.req.valid("query"))))
  .get("/plantio/talhoes/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterTalhao(id);
    return dto ? c.json(dto) : c.json({ error: "talhão não encontrado" }, 404);
  })
  .post("/plantio/talhoes", zValidator("json", criarTalhaoSchema), async (c) => {
    try { return c.json(await svc.criarTalhao(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/plantio/talhoes/:id", zValidator("json", editarTalhaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarTalhao(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/plantio/talhoes/:id/baixa", zValidator("json", baixaSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.darBaixa(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
