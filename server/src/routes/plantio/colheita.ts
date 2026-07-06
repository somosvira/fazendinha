import { Hono } from "hono";
import { listarPassadas } from "../../services/plantio/colheita.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

// Passadas de colheita reais (PassadaColheita) — alimenta a view "Passadas
// registradas" da aba Colheita. `?ano=` opcional filtra pelo ano-calendário.
export const plantioColheitaRouter = new Hono().get("/plantio/passadas", async (c) => {
  const raw = c.req.query("ano");
  const ano = raw != null && raw !== "" ? Number(raw) : undefined;
  const filtro = Number.isInteger(ano) ? { ano: ano as number } : undefined;
  return c.json(await listarPassadas(filtro, await resolverEscopoLeitura(c)));
});
