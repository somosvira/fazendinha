import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { obterAgenda } from "../../services/rebanho/agenda.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

const querySchema = z.object({ dias: z.coerce.number().int().min(1).max(365).optional() });

// Agenda unificada de manejos futuros (vacinas agendadas + próximas etapas IATF de lote).
export const agendaRouter = new Hono()
  .get("/rebanho/agenda", zValidator("query", querySchema), async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await obterAgenda(propriedadeId, c.req.valid("query").dias));
  });
