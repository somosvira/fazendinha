import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as svc from "../../services/rebanho/lotes.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const criarLocalSchema = z.object({ nome: z.string().min(1).max(80), ativo: z.boolean().optional() });
const criarLoteSchema = z.object({
  produtoId: z.number().int().positive(),
  codigo: z.string().min(1, "informe o código do lote").max(60),
  validade: isoDate.nullable().optional(),
  localId: z.number().int().positive().nullable().optional(),
  quantidade: z.number().min(0).max(9_999_999).nullable().optional(),
});

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.LoteError) return { status: 404, body: { error: e.message } };
  console.error("[lotes]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Lotes de produto (código + validade + local) + locais de armazenamento.
export const lotesRouter = new Hono()
  .get("/rebanho/locais-armazenamento", async (c) => c.json(await svc.listarLocais(await resolverEscopoLeitura(c))))
  .post("/rebanho/locais-armazenamento", zValidator("json", criarLocalSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.criarLocal(c.req.valid("json"), propriedadeId), 201);
  })
  .delete("/rebanho/locais-armazenamento/:id", async (c) => {
    try { await svc.excluirLocal(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/lotes-produto", async (c) => c.json(await svc.listarLotes(await resolverEscopoLeitura(c))))
  .post("/rebanho/lotes-produto", zValidator("json", criarLoteSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.criarLote(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/lotes-produto/:id", async (c) => {
    try { await svc.excluirLote(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
