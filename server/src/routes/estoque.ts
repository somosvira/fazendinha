import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as svc from "../services/estoque/estoque.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import { exigePermissao, getUsuario } from "../middleware/permissao.js";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.EstoqueError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409, ORIGEM_AUTOMATICA: 409, CONFLITO: 409, VALIDACAO: 400 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[estoque]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// `0` = "sem centro de custo"; ausente = sem filtro.
const saldosQuerySchema = z.object({ centroCustoId: z.coerce.number().int().nonnegative().optional() });

const usuarioId = (c: Parameters<typeof getUsuario>[0]) => getUsuario(c)?.id ?? null;

// Leituras ficam só com o gate de área (app.ts); escritas exigem a flag `lancar`.
export const estoqueRouter = new Hono()
  .get("/estoque/saldos", zValidator("query", saldosQuerySchema), async (c) => {
    const { centroCustoId } = c.req.valid("query");
    return c.json(await svc.listarSaldos({ centroCustoId, propriedadeId: await resolverEscopoLeitura(c) }));
  })
  .get("/estoque/movimentos", async (c) => {
    const produtoId = c.req.query("produtoId");
    return c.json(await svc.listarMovimentos({ produtoId: produtoId ? Number(produtoId) : undefined, tipo: c.req.query("tipo"), propriedadeId: await resolverEscopoLeitura(c) }));
  })
  .post("/estoque/ajustes", exigePermissao("lancar"), zValidator("json", svc.ajusteContagemSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      if (propriedadeId == null) throw new svc.EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
      return c.json(await svc.ajustarContagem({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/estoque/movimentos", exigePermissao("lancar"), zValidator("json", svc.movimentoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await svc.registrarMovimento({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/estoque/movimentos/:id", exigePermissao("lancar"), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirMovimento(Number(c.req.param("id")), propriedadeId, usuarioId(c));
      return c.json({ ok: true });
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/estoque/custo-vaca-dia", async (c) => {
    const dias = c.req.query("dias");
    return c.json(await svc.calcularCustoVacaDia(dias ? Number(dias) : undefined, await resolverEscopoLeitura(c)));
  });
