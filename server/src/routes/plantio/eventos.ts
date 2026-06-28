import { Hono } from "hono";
import { eventos } from "../../services/plantio/mock.js";

export const plantioEventosRouter = new Hono()
  .get("/plantio/talhoes/:id/eventos", (c) => {
    const id = c.req.param("id");
    const arr = eventos.filter((e) => e.talhaoId === id).sort((a, b) => b.data.localeCompare(a.data));
    return c.json(arr);
  });
