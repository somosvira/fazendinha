import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { buscarEntidades } from "../services/busca.js";
import { getUsuario } from "../middleware/permissao.js";
import { temArea, type Area } from "../services/auth/papeis.js";

const buscaQuerySchema = z.object({ q: z.string().max(60).optional() });

/* Busca global de entidades reais para a paleta ⌘K. Montado em /api → GET /api/busca?q= */
export const buscaRouter = new Hono().get("/busca", zValidator("query", buscaQuerySchema), async (c) => {
  const usuario = getUsuario(c);
  const resultados = await buscarEntidades(c.req.valid("query").q ?? "");
  const areaDaTab = (tab: string): Area => tab.startsWith("pec-") ? "pecuaria"
    : "financeiro";
  return c.json(usuario ? resultados.filter((r) => temArea(usuario, areaDaTab(r.tab))) : []);
});
