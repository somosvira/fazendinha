import { Hono } from "hono";
import { agregarCustoProducao } from "../../services/rebanho/custo-producao.js";

export const custoProducaoRouter = new Hono().get("/rebanho/custo-producao", async (c) => {
  const meses = Number(c.req.query("meses")) || 12;
  return c.json(await agregarCustoProducao(meses));
});
