import { Hono } from "hono";
import { eventos } from "../../services/corte/mock.js";

export const corteEventosRouter = new Hono()
  .get("/corte/lotes/:id/eventos", (c) => {
    const id = c.req.param("id");
    const arr = eventos.filter((e) => e.loteId === id).sort((a, b) => b.data.localeCompare(a.data));
    return c.json(arr);
  });
