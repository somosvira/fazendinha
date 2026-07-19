import { Hono } from "hono";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { montarCockpitHoje } from "../../services/rebanho/cockpit.js";

// Cockpit do Dia: contadores de ação do dia + saldo do dia/mês, no escopo do sítio ativo.
export const rebanhoHojeRouter = new Hono().get("/rebanho/hoje", async (c) => {
  const propriedadeId = await resolverEscopoLeitura(c);
  return c.json(await montarCockpitHoje(propriedadeId));
});
