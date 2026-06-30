import { Hono } from "hono";
import { agregarCustoPlantio } from "../../services/plantio/custo.js";

// Ponte financeira do café — espelha /api/rebanho/custo-producao.
export const plantioCustoRouter = new Hono().get("/plantio/custo", async (c) => {
  const meses = Number(c.req.query("meses")) || 12;
  return c.json(await agregarCustoPlantio(meses));
});
