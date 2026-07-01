import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarSafraCultivoSchema, editarSafraCultivoSchema, listSafraCultivoFiltrosSchema } from "../../services/cultivo/schemas.js";
import * as svc from "../../services/cultivo/safras.js";
import { toResumoSafraCultivoDTO } from "../../services/cultivo/mappers.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.SafraCultivoError) {
    const map = { NAO_ENCONTRADO: 404, SAFRA_FECHADA: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[cultivo/safras]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico → 404 antes de chamar o Prisma (que jogaria 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rotas de SafraCultivo (módulo Cultivo — milho) — espelham /api/plantio/talhoes.
export const cultivoSafrasRouter = new Hono()
  .get("/cultivo/safras", zValidator("query", listSafraCultivoFiltrosSchema), async (c) => c.json(await svc.listarSafrasCultivo(c.req.valid("query"))))
  .get("/cultivo/safras/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterSafraCultivo(id);
    return dto ? c.json(dto) : c.json({ error: "safra de cultivo não encontrada" }, 404);
  })
  .post("/cultivo/safras", zValidator("json", criarSafraCultivoSchema), async (c) => {
    try { return c.json(await svc.criarSafraCultivo(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/cultivo/safras/:id", zValidator("json", editarSafraCultivoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarSafraCultivo(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/safras/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirSafraCultivo(id); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/cultivo/safras/:id/fechar", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.fecharSafraCultivo(id)); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/cultivo/safras/:id/reabrir", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.reabrirSafraCultivo(id)); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .get("/cultivo/safras/:id/resumo", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      const resumo = await svc.obterResumoSafraCultivo(id);
      const dto = toResumoSafraCultivoDTO(resumo);
      if (!dto) return c.json({ error: "resumo ainda não calculado para esta safra" }, 404);

      const classeRaw = c.req.query("classe") ?? "custeio";
      const classe = (["custeio", "investimento", "tudo"] as const).includes(classeRaw as any) ? (classeRaw as "custeio" | "investimento" | "tudo") : "custeio";
      // custoHa/custoSaca/custoTonelada são sempre calculados sobre custeio (§2, §5.1);
      // classe só filtra qual total headline é exibido (custeioTotal/investimentoTotal/soma).
      const total = classe === "investimento" ? dto.investimentoTotal : classe === "tudo" ? dto.custeioTotal + dto.investimentoTotal : dto.custeioTotal;

      return c.json({ ...dto, classe, total });
    } catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
