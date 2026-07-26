import { Hono } from "hono";
import { montarRelatorioEmbrapa } from "../../services/rebanho/indicadores-embrapa.agg.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const indicadoresEmbrapaRouter = new Hono().get(
  "/rebanho/indicadores-embrapa",
  async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await montarRelatorioEmbrapa(propriedadeId));
  },
);
