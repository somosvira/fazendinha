import { Hono } from "hono";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { obterSugestoes } from "../../services/rebanho/sugestoes.js";

// Feed completo de sugestões do "Hoje" preditivo, no escopo do sítio ativo.
export const sugestoesRouter = new Hono().get("/rebanho/sugestoes", async (c) => {
  const propriedadeId = await resolverEscopoLeitura(c);
  return c.json(await obterSugestoes(propriedadeId));
});
