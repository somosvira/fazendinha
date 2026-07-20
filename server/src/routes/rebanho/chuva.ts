import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as svc from "../../services/rebanho/chuva.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const registrarSchema = z.object({
  data: isoDate,
  mm: z.number().min(0, "mm não pode ser negativo").max(99_999),
  observacao: z.string().max(200).nullable().optional(),
});

function fail(e: unknown): { status: 404 | 500; body: { error: string } } {
  if (e instanceof svc.ChuvaError) return { status: 404, body: { error: e.message } };
  console.error("[chuva]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Registro de chuva (pluviômetro) — mm/dia + acumulado mensal.
export const chuvaRouter = new Hono()
  .get("/rebanho/chuva", async (c) => c.json(await svc.listarChuva(await resolverEscopoLeitura(c))))
  .post("/rebanho/chuva", zValidator("json", registrarSchema), async (c) => {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.registrarChuva(c.req.valid("json"), propriedadeId), 201);
  })
  .delete("/rebanho/chuva/:id", async (c) => {
    try { await svc.excluirChuva(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
