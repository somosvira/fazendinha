import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  criarManejoSchema,
  criarSuplementacaoSchema,
  criarOperacaoSchema,
} from "../../services/corte/schemas.corte-eventos.js";
import { montarTimeline } from "../../services/corte/timeline.js";
import {
  CorteEventoError,
  criarManejoSanitario,
  listarManejos,
  criarSuplementacao,
  listarSuplementacoes,
} from "../../services/corte/manejo.js";
import { criarOperacaoComercial, listarOperacoes } from "../../services/corte/operacoes.js";

function handle(err: unknown): { status: 404 | 400 | 500; body: { error: string } } {
  if (err instanceof CorteEventoError) {
    const map = { NAO_ENCONTRADO: 404, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[corte/eventos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ex.: /lotes/abc) → 404 antes de chamar o Prisma.
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/* Rotas de eventos do Corte (Onda 2) — timeline tecida + criação de manejo
 * sanitário, suplementação e operação comercial. Prisma. */
export const corteEventosRouter = new Hono()
  .get("/corte/lotes/:id/eventos", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await montarTimeline(id));
  })
  .get("/corte/lotes/:id/manejo-sanitario", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await listarManejos(id));
  })
  .post("/corte/lotes/:id/manejo-sanitario", zValidator("json", criarManejoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await criarManejoSanitario(id, c.req.valid("json")), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .get("/corte/lotes/:id/suplementacao", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await listarSuplementacoes(id));
  })
  .post("/corte/lotes/:id/suplementacao", zValidator("json", criarSuplementacaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await criarSuplementacao(id, c.req.valid("json")), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .get("/corte/operacoes", async (c) => {
    const raw = c.req.query("loteId");
    const loteId = raw != null ? parseId(raw) ?? undefined : undefined;
    return c.json(await listarOperacoes(loteId));
  })
  .post("/corte/operacoes", zValidator("json", criarOperacaoSchema), async (c) => {
    try {
      return c.json(await criarOperacaoComercial(c.req.valid("json")), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  });
