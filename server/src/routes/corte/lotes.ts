import { Hono } from "hono";
import { lotes, anexarResumo, piquetes } from "../../services/corte/mock.js";

export const corteLotesRouter = new Hono()
  .get("/corte/lotes", (c) => {
    const url = new URL(c.req.url);
    const estado = url.searchParams.get("estado");
    const categoria = url.searchParams.get("categoria");
    const q = url.searchParams.get("q")?.toLowerCase();
    let arr = lotes;
    if (estado && estado !== "TODOS") arr = arr.filter((l) => l.estado === estado);
    if (categoria) arr = arr.filter((l) => l.categoria === categoria);
    if (q) arr = arr.filter((l) => l.codigo.toLowerCase().includes(q) || l.nome.toLowerCase().includes(q));
    return c.json(arr.map(anexarResumo));
  })
  .get("/corte/lotes/:id", (c) => {
    const l = lotes.find((x) => x.id === c.req.param("id"));
    if (!l) return c.json({ error: "lote não encontrado" }, 404);
    return c.json(anexarResumo(l));
  })
  .get("/corte/piquetes", (c) => c.json(piquetes));
