import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { obterCarteira, simularDescarteCarteira } from "../../services/rebanho/carteira.js";
import { obterComposicaoRacial } from "../../services/rebanho/composicao-racial.js";
import { obterQuantitativo } from "../../services/rebanho/quantitativo.js";

// n é clampado a [0, totalAnimais] pelo calc puro; aqui só garantimos inteiro >= 0.
const simularSchema = z.object({ n: z.coerce.number().int().min(0).default(0) });

export const carteiraRouter = new Hono()
  .get("/rebanho/carteira", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await obterCarteira(propriedadeId));
  })
  .get("/rebanho/carteira/simular-descarte", zValidator("query", simularSchema), async (c) => {
    const { n } = c.req.valid("query");
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await simularDescarteCarteira(propriedadeId, n));
  })
  .get("/rebanho/composicao-racial", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await obterComposicaoRacial(propriedadeId));
  })
  .get("/rebanho/quantitativo", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await obterQuantitativo(propriedadeId));
  });
