import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { obterComposicao, definirComposicao, ComposicaoProdutoError } from "../../services/rebanho/composicao-produto.js";
import { composicaoRacaoSchema } from "@fazendinha/shared";
import { parseEntityId } from "../../lib/ids.js";

const definirSchema = composicaoRacaoSchema;

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof ComposicaoProdutoError) return { status: 404, body: { error: e.message } };
  console.error("[composicao-produto]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Composição (receita) de um produto — ração formulada.
export const composicaoProdutoRouter = new Hono()
  .get("/rebanho/produtos/:id/composicao-racao", async (c) => {
    try { return c.json(await obterComposicao(parseEntityId(c.req.param("id")))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .put("/rebanho/produtos/:id/composicao-racao", zValidator("json", definirSchema), async (c) => {
    try { return c.json(await definirComposicao(parseEntityId(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
