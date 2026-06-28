import { Hono } from "hono";
import { talhoes, resumos, anexarResumo } from "../../services/plantio/mock.js";

/* Rotas de Talhão — espelham /api/rebanho/animais. Por ora servem o mock
 * estático em memória; quando o Prisma for plugado, basta trocar pelo
 * cliente Prisma mantendo a mesma forma de retorno. */
export const plantioTalhoesRouter = new Hono()
  .get("/plantio/talhoes", (c) => {
    const url = new URL(c.req.url);
    const estado = url.searchParams.get("estado");
    const lavoura = url.searchParams.get("lavoura");
    const q = url.searchParams.get("q")?.toLowerCase();
    let arr = talhoes;
    if (estado && estado !== "TODOS") arr = arr.filter((t) => t.estado === estado);
    if (lavoura) arr = arr.filter((t) => t.lavoura === lavoura);
    if (q) arr = arr.filter((t) => t.nome.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q));
    return c.json(arr.map((t) => anexarResumo(t, resumos)));
  })
  .get("/plantio/talhoes/:id", (c) => {
    const id = c.req.param("id");
    const t = talhoes.find((x) => x.id === id);
    if (!t) return c.json({ error: "talhão não encontrado" }, 404);
    return c.json(anexarResumo(t, resumos));
  });
