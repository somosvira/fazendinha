import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarAreaCultivoSchema, editarAreaCultivoSchema, listAreaCultivoFiltrosSchema } from "../../services/cultivo/schemas.js";
import * as svc from "../../services/cultivo/areas.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.AreaCultivoError) {
    const map = { NAO_ENCONTRADO: 404, REF_INVALIDA: 400, CODIGO_DUPLICADO: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[cultivo/areas]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rotas de AreaCultivo (granularidade opcional dentro de uma SafraCultivo).
export const cultivoAreasRouter = new Hono()
  .get("/cultivo/areas", zValidator("query", listAreaCultivoFiltrosSchema), async (c) => c.json(await svc.listarAreasCultivo(c.req.valid("query"))))
  .get("/cultivo/areas/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterAreaCultivo(id);
    return dto ? c.json(dto) : c.json({ error: "área de cultivo não encontrada" }, 404);
  })
  .post("/cultivo/areas", zValidator("json", criarAreaCultivoSchema), async (c) => {
    try { return c.json(await svc.criarAreaCultivo(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/cultivo/areas/:id", zValidator("json", editarAreaCultivoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarAreaCultivo(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/areas/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirAreaCultivo(id); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
