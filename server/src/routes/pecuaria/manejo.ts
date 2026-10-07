import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import * as manejo from "../../services/pecuaria/manejo/manejo.js";

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const validar = <T extends z.ZodTypeAny>(s: T) => zValidator("json", s, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
function falha(c: Context, e: unknown) {
  if (e instanceof RebanhoError) return c.json({ error: e.message, code: e.code, campo: e.campo }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(e.code)) return c.json({ error: "Conflito de atualização; recarregue e tente novamente", code: "CONFLITO" }, 409);
  console.error("[pecuaria/manejo]", e);
  return c.json({ error: "Erro inesperado ao registrar manejo" }, 500);
}

export const manejoRouter = new Hono()
  .post("/eventos/:id/anulacao", validar(z.object({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await manejo.anularManejo(c.req.param("id"), propriedadeId, body.motivo, getUsuario(c)?.id ?? null)); } catch (e) { return falha(c, e); }
  })
  .post("/pesagens-coletivas", validar(z.object({ chave: uuid, propriedadeId: z.number().int().positive(), data,
    tipo: z.enum(["ROTINA", "ENTRADA", "DESMAMA", "SAIDA"]), origem: z.enum(["MANUAL", "BALANCA"]),
    itens: z.array(z.object({ animalId: uuid, pesoKg: z.number().positive().max(99999.99), observacao: z.string().trim().max(500).nullish() })).min(1).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await manejo.registrarPesagensColetivas({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/eventos", async (c) => {
    try { const animalId = c.req.query("animalId"); if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json(await manejo.listarManejos(animalId, await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/eventos", validar(z.object({ chave: uuid.optional(), animalId: uuid, propriedadeId: z.number().int().positive(), data,
    tipo: z.enum(["DESMAMA", "CASTRACAO"]), pesoKg: z.number().positive().max(99999.99).nullish(),
    responsavel: z.string().trim().max(160).nullish(), observacao: z.string().trim().max(500).nullish() })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await manejo.registrarManejo({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  });
