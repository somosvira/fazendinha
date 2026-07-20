import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarFiltroSchema } from "../../services/rebanho/animais.schemas.js";
import * as svc from "../../services/rebanho/filtros.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

// Filtros de animais salvos (nomeados). CRUD simples; a aplicação reusa listarAnimais no front.
export const filtrosRouter = new Hono()
  .get("/rebanho/filtros", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await svc.listarFiltros(propriedadeId));
  })
  .post("/rebanho/filtros", zValidator("json", criarFiltroSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.criarFiltro(c.req.valid("json"), propriedadeId), 201);
  })
  .delete("/rebanho/filtros/:id", async (c) => {
    try { await svc.excluirFiltro(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) {
      if (e instanceof svc.FiltroError) return c.json({ error: e.message }, 404);
      console.error("[filtros]", e); return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
    }
  });
