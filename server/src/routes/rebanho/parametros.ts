import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  CHAVES_PARAMETRO,
  getParametros,
  resetParametro,
  salvarParametros,
  type ChaveParametro,
  type ParametroPatch,
} from "../../services/rebanho/parametros.js";

const chaveEnum = z.enum(CHAVES_PARAMETRO as [ChaveParametro, ...ChaveParametro[]]);

const patchItemSchema = z.object({
  chave: chaveEnum,
  valorNumero: z.number().nullable().optional(),
  valorNumeroAceitavel: z.number().nullable().optional(),
  valorTexto: z.string().nullable().optional(),
  modo: z.string().nullable().optional(),
});

const patchBodySchema = z.object({
  parametros: z.array(patchItemSchema).min(1).max(CHAVES_PARAMETRO.length),
});

const resetBodySchema = z.object({ chave: chaveEnum });

export const parametrosRouter = new Hono()
  .get("/rebanho/parametros", async (c) => c.json(await getParametros()))
  .patch("/rebanho/parametros", zValidator("json", patchBodySchema), async (c) => {
    const body = c.req.valid("json");
    const atualizados = await salvarParametros(body.parametros as ParametroPatch[]);
    return c.json(atualizados);
  })
  .post("/rebanho/parametros/reset", zValidator("json", resetBodySchema), async (c) => {
    const body = c.req.valid("json");
    const p = await resetParametro(body.chave);
    return c.json(p);
  });
