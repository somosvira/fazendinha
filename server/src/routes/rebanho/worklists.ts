import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { buildRebanhoWorklist } from "../../services/rebanho/dashboard-rebanho.js";
import { CHAVES_WORKLIST_REBANHO } from "../../services/rebanho/dashboard.types.js";

export const chaveWorklistSchema = z.enum(CHAVES_WORKLIST_REBANHO);

const paramSchema = z.object({ chave: chaveWorklistSchema });

export const rebanhoWorklistsRouter = new Hono().get(
  "/rebanho/worklists/:chave",
  zValidator("param", paramSchema),
  async (c) => {
    const { chave } = c.req.valid("param");
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await buildRebanhoWorklist(chave, propriedadeId));
  },
);
