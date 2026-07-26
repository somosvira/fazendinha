import { Hono } from "hono";
import { agregarCustoSanidade } from "../../services/rebanho/custo-sanidade.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const custoSanidadeRouter = new Hono().get("/rebanho/custo-sanidade", async (c) => {
  const meses = Number(c.req.query("meses") ?? 12);
  return c.json(await agregarCustoSanidade(Number.isFinite(meses) && meses > 0 ? meses : 12, await resolverEscopoLeitura(c)));
});
