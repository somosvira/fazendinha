import { Hono } from "hono";
import { agregarCustoProducao } from "../../services/rebanho/custo-producao.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const custoProducaoRouter = new Hono().get("/rebanho/custo-producao", async (c) => {
  const meses = Number(c.req.query("meses")) || 12;
  return c.json(await agregarCustoProducao(meses, await resolverEscopoLeitura(c)));
});
