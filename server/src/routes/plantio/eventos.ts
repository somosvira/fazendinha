import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarOperacaoSchema, editarOperacaoSchema } from "../../services/plantio/schemas.js";
import { montarTimeline, criarOperacao, editarOperacao, excluirOperacao, PlantioEventoError } from "../../services/plantio/timeline.js";

function handle(err: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (err instanceof PlantioEventoError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[plantio/eventos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ex.: /talhoes/abc/eventos) → 404 antes de chamar o Prisma.
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Timeline tecida do talhão (5 tabelas → 1 DTO) + registro de operação.
export const plantioEventosRouter = new Hono()
  .get("/plantio/talhoes/:id/eventos", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await montarTimeline(id));
  })
  .post("/plantio/talhoes/:id/operacoes", zValidator("json", criarOperacaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await criarOperacao(id, c.req.valid("json")), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .patch("/plantio/operacoes/:id", zValidator("json", editarOperacaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await editarOperacao(id, c.req.valid("json")));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .delete("/plantio/operacoes/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      await excluirOperacao(id);
      return c.body(null, 204);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  });
