import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { buildRebanhoWorklist } from "../../services/rebanho/dashboard-rebanho.js";

export const chaveWorklistSchema = z.enum([
  "secagem-atrasada",
  "vazia-pos-pev",
  "ccs-alta",
  "dg-pendente",
  "parto-proximo",
  "carencia",
]);

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
