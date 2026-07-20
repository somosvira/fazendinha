import { Hono } from "hono";
import { obterAnaliseLeite } from "../../services/rebanho/analise-leite.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

// Análise de leite (qualidade): tendência de CCS + distribuição por faixa + piores animais.
export const analiseLeiteRouter = new Hono()
  .get("/rebanho/producao/analise-leite", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await obterAnaliseLeite(propriedadeId));
  });
