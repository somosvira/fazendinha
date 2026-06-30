import { Hono } from "hono";
import { montarRelatorioEmbrapa } from "../../services/rebanho/indicadores-embrapa.agg.js";

export const indicadoresEmbrapaRouter = new Hono().get(
  "/rebanho/indicadores-embrapa",
  async (c) => c.json(await montarRelatorioEmbrapa())
);
