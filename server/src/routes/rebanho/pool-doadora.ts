import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import * as svc from "../../services/rebanho/pool-doadora.js";
import { aplicarPoolSchema, atualizarGrupoPoolSchema, criarGrupoPoolSchema, salvarItensPoolSchema } from "../../services/rebanho/pool-doadora.schemas.js";
const idPositivo = (raw: string) => { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; };
function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.PoolDoadoraError) return { status: e.code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: e.message } };
  console.error("[pool-doadora]", e); return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}
export const poolDoadoraRouter = new Hono()
  .get("/rebanho/fiv/pools", async (c) => { try { return c.json(await svc.listarGruposPool(await resolverEscopoLeitura(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .post("/rebanho/fiv/pools", zValidator("json", criarGrupoPoolSchema), async (c) => { try { return c.json(await svc.criarGrupoPool(c.req.valid("json"), await resolverEscopoEscrita(c)), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/fiv/pools/:id", zValidator("json", atualizarGrupoPoolSchema), async (c) => { try { const id = idPositivo(c.req.param("id")); if (id == null) throw new svc.PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado"); return c.json(await svc.atualizarGrupoPool(id, c.req.valid("json"), await resolverEscopoEscrita(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .put("/rebanho/fiv/pools/:id/itens", zValidator("json", salvarItensPoolSchema), async (c) => { try { const id = idPositivo(c.req.param("id")); if (id == null) throw new svc.PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado"); return c.json(await svc.salvarItensGrupoPool(id, c.req.valid("json").doadoraIds, await resolverEscopoEscrita(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .post("/rebanho/fiv/pools/:id/aplicar", zValidator("json", aplicarPoolSchema), async (c) => { try { const id = idPositivo(c.req.param("id")); if (id == null) throw new svc.PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado"); return c.json(await svc.aplicarPool(id, c.req.valid("json"), await resolverEscopoEscrita(c)), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
