import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarLancamentoCustoSchema, editarLancamentoCustoSchema, listLancamentoCustoFiltrosSchema } from "../../services/cultivo/schemas.js";
import * as svc from "../../services/cultivo/custos.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.LancamentoCustoError) {
    const map = { NAO_ENCONTRADO: 404, REF_INVALIDA: 400, SAFRA_FECHADA: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[cultivo/custos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rotas de LancamentoCusto (balde de custo da safra/área) — aceita ?classe=
// custeio|investimento|tudo no filtro de listagem (§6.4). Toda mutação
// dispara recomputarResumoSafra e respeita o fechamento da safra (§6.3).
export const cultivoCustosRouter = new Hono()
  .get("/cultivo/custos", zValidator("query", listLancamentoCustoFiltrosSchema), async (c) => c.json(await svc.listarLancamentosCusto(c.req.valid("query"))))
  .get("/cultivo/custos/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterLancamentoCusto(id);
    return dto ? c.json(dto) : c.json({ error: "lançamento de custo não encontrado" }, 404);
  })
  .post("/cultivo/custos", zValidator("json", criarLancamentoCustoSchema), async (c) => {
    try { return c.json(await svc.criarLancamentoCusto(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/cultivo/custos/:id", zValidator("json", editarLancamentoCustoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarLancamentoCusto(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/custos/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirLancamentoCusto(id); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
