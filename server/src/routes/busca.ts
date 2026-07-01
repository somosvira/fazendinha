import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { buscarEntidades } from "../services/busca.js";

const buscaQuerySchema = z.object({ q: z.string().max(60).optional() });

/* Busca global de entidades reais para a paleta ⌘K. Montado em /api → GET /api/busca?q= */
export const buscaRouter = new Hono().get("/busca", zValidator("query", buscaQuerySchema), async (c) =>
  c.json(await buscarEntidades(c.req.valid("query").q ?? ""))
);
