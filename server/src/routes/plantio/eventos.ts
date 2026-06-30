import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarOperacaoSchema } from "../../services/plantio/schemas.js";
import { montarTimeline, criarOperacao, PlantioEventoError } from "../../services/plantio/timeline.js";

function handle(err: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (err instanceof PlantioEventoError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[plantio/eventos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Timeline tecida do talhão (5 tabelas → 1 DTO) + registro de operação.
export const plantioEventosRouter = new Hono()
  .get("/plantio/talhoes/:id/eventos", async (c) => c.json(await montarTimeline(Number(c.req.param("id")))))
  .post("/plantio/talhoes/:id/operacoes", zValidator("json", criarOperacaoSchema), async (c) => {
    try {
      return c.json(await criarOperacao(Number(c.req.param("id")), c.req.valid("json")), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  });
