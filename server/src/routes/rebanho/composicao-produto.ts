import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { obterComposicao, definirComposicao, ComposicaoProdutoError } from "../../services/rebanho/composicao-produto.js";

const definirSchema = z.object({
  itens: z.array(z.object({
    ingredienteId: z.number().int().positive(),
    proporcao: z.number().min(0).max(100),
  })).max(50),
});

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof ComposicaoProdutoError) return { status: 404, body: { error: e.message } };
  console.error("[composicao-produto]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Composição (receita) de um produto — ração formulada.
export const composicaoProdutoRouter = new Hono()
  .get("/rebanho/produtos/:id/composicao-racao", async (c) => {
    try { return c.json(await obterComposicao(Number(c.req.param("id")))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .put("/rebanho/produtos/:id/composicao-racao", zValidator("json", definirSchema), async (c) => {
    try { return c.json(await definirComposicao(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
