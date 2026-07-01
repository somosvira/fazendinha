import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarProducaoCultivoSchema, editarProducaoCultivoSchema, listProducaoCultivoFiltrosSchema } from "../../services/cultivo/schemas.js";
import * as svc from "../../services/cultivo/producao.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.ProducaoCultivoError) {
    const map = { NAO_ENCONTRADO: 404, REF_INVALIDA: 400, SAFRA_FECHADA: 409 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[cultivo/producao]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rotas de ProducaoCultivo (saída da colheita: grão SC / silagem TON).
// destino=SILO + siloId cria MovimentoSilo(ENTRADA/COLHEITA) automaticamente
// e recomputa o saldo do silo (§5.2). Toda mutação também recomputa o
// resumo da safra e respeita o fechamento (§6.3).
export const cultivoProducaoRouter = new Hono()
  .get("/cultivo/producao", zValidator("query", listProducaoCultivoFiltrosSchema), async (c) => c.json(await svc.listarProducoesCultivo(c.req.valid("query"))))
  .get("/cultivo/producao/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await svc.obterProducaoCultivo(id);
    return dto ? c.json(dto) : c.json({ error: "produção não encontrada" }, 404);
  })
  .post("/cultivo/producao", zValidator("json", criarProducaoCultivoSchema), async (c) => {
    try { return c.json(await svc.criarProducaoCultivo(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/cultivo/producao/:id", zValidator("json", editarProducaoCultivoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { return c.json(await svc.editarProducaoCultivo(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .delete("/cultivo/producao/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try { await svc.excluirProducaoCultivo(id); return c.body(null, 204); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
