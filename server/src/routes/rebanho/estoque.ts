import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as svc from "../../services/rebanho/estoque.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";
import { getUsuario } from "../../middleware/permissao.js";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.EstoqueError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409, ORIGEM_AUTOMATICA: 409, CONFLITO: 409, VALIDACAO: 400 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[estoque]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const estoqueRouter = new Hono()
  .get("/rebanho/estoque/saldos", async (c) => c.json(await svc.listarSaldos({ setor: c.req.query("setor"), propriedadeId: await resolverEscopoLeitura(c) })))
  .get("/rebanho/estoque/movimentos", async (c) => {
    const produtoId = c.req.query("produtoId");
    return c.json(await svc.listarMovimentos({ produtoId: produtoId ? Number(produtoId) : undefined, tipo: c.req.query("tipo"), propriedadeId: await resolverEscopoLeitura(c) }));
  })
  .post("/rebanho/estoque/ajustes", zValidator("json", svc.ajusteContagemSchema), async c => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = input.propriedadeId ?? await resolverEscopoLeitura(c);
      if (propriedadeId == null) throw new svc.EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
      return c.json(await svc.ajustarContagem({ ...input, propriedadeId, usuarioId: getUsuario(c)?.id }), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/rebanho/estoque/movimentos", zValidator("json", svc.movimentoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await svc.registrarMovimento({ ...input, propriedadeId }), 201);
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/estoque/movimentos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirMovimento(Number(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/estoque/custo-vaca-dia", async (c) => {
    const dias = c.req.query("dias");
    return c.json(await svc.calcularCustoVacaDia(dias ? Number(dias) : undefined, await resolverEscopoLeitura(c)));
  });
