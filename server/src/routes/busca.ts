import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { buscarEntidades, qValido } from "../services/busca.js";
import { getUsuario } from "../middleware/permissao.js";
import { resolverEscopoLeitura, PropriedadeError } from "../services/propriedade.js";

const TIPOS_BUSCA = ["animal"] as const;
// `tipos` restringe as fontes (ex.: busca só de animais, Ctrl/⌘ Shift K); a autorização continua no serviço.
const buscaQuerySchema = z.object({
  q: z.string().trim().max(60).default(""),
  tipos: z.string().optional().transform(v => v ? v.split(",").map(t => t.trim()).filter(Boolean) : undefined)
    .pipe(z.array(z.enum(TIPOS_BUSCA)).min(1).optional()),
});
export const buscaRouter = new Hono().get("/busca", zValidator("query", buscaQuerySchema), async (c) => {
  const usuario = getUsuario(c);
  if (!usuario) return c.json({ error: "não autenticado" }, 401);
  const { q, tipos } = c.req.valid("query");
  if (!qValido(q)) return c.json([]);
  try {
    return c.json(await buscarEntidades(q, usuario, await resolverEscopoLeitura(c), tipos));
  } catch (e) {
    if (e instanceof PropriedadeError) return c.json({ error: e.message, code: e.code }, 422);
    throw e;
  }
});
