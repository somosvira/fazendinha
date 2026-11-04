import { getUsuario } from "../middleware/permissao.js";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { bodyLimit } from "hono/body-limit";
import {
  contextoAssistente,
  falhaAssistente,
} from "../services/assistente/contexto-http.js";
import {
  apurarMetasAutomaticas,
  catalogoMetas,
  gravarMeta,
  listarMetas,
  MetasAcessoError,
} from "../services/assistente/metas/servico.js";
import {
  salvarMetaSchema,
  medicaoSchema,
} from "../services/assistente/metas/regras.js";
const falha = (c: Parameters<typeof falhaAssistente>[0], e: unknown) =>
  e instanceof MetasAcessoError
    ? c.json({ error: e.message }, 403)
    : falhaAssistente(c, e);
const autenticarMetas: MiddlewareHandler = async (c, next) => {
  const u = getUsuario(c);
  c.header("Cache-Control", "no-store");
  if (!u || u.id <= 0 || u.status !== "ATIVO")
    return c.json({ error: "Autentique-se para acessar metas." }, 401);
  return next();
};
export const assistenteMetasRouter = new Hono()
  .use("/metas", autenticarMetas)
  .use("/metas/*", autenticarMetas)
  .get("/metas/catalogo", async (c) => {
    try {
      return c.json(catalogoMetas(await contextoAssistente(c)));
    } catch (e) {
      return falha(c, e);
    }
  })
  .get("/metas", async (c) => {
    try {
      return c.json(await listarMetas(await contextoAssistente(c)));
    } catch (e) {
      return falha(c, e);
    }
  })
  // Abrir Metas apura os dias pendentes do sítio sem esperar o cron diário.
  .post("/metas/apuracao", async (c) => {
    try {
      const ctx = await contextoAssistente(c);
      const { podeEditar } = catalogoMetas(ctx);
      if (podeEditar && ctx.propriedadeId !== null)
        await apurarMetasAutomaticas(ctx.propriedadeId, ctx.agora);
      return c.json(await listarMetas(ctx));
    } catch (e) {
      return falha(c, e);
    }
  })
  .put(
    "/metas/:id",
    bodyLimit({ maxSize: 16000 }),
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", salvarMetaSchema),
    async (c) => {
      try {
        return c.json(
          await gravarMeta(
            c.req.valid("param").id,
            c.req.valid("json"),
            "definicao",
            await contextoAssistente(c),
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/metas/:id/medicoes",
    bodyLimit({ maxSize: 16000 }),
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", medicaoSchema),
    async (c) => {
      try {
        return c.json(
          await gravarMeta(
            c.req.valid("param").id,
            c.req.valid("json"),
            "medicao",
            await contextoAssistente(c),
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  );
