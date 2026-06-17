import { Hono } from "hono";
import { agregarCustoSanidade } from "../../services/rebanho/custo-sanidade.js";

export const custoSanidadeRouter = new Hono().get("/rebanho/custo-sanidade", async (c) => {
  const meses = Number(c.req.query("meses") ?? 12);
  return c.json(await agregarCustoSanidade(Number.isFinite(meses) && meses > 0 ? meses : 12));
});
