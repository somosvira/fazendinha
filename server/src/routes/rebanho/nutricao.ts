import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { dietaSchema, loteSchema, dietaItensSchema } from "../../services/rebanho/nutricao.js";
import * as svc from "../../services/rebanho/nutricao.js";
import { consumoSchema } from "../../services/rebanho/nutricao.consumo.js";
import * as consumo from "../../services/rebanho/nutricao.consumo.js";
import { parseEntityId } from "../../lib/ids.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

type Status = 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.NutricaoError) {
    const map = { NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409, EM_USO: 409, SEM_DIETA: 409, JA_FECHADO: 409, MES_FECHADO: 409, PERIODO_INVALIDO: 409, ANIMAL_FORA_ESCOPO: 409 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[nutricao]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const nutricaoRouter = new Hono()
  .get("/rebanho/dietas", async (c) => c.json(await svc.listarDietas()))
  .post("/rebanho/dietas", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.criarDieta(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/dietas/:id", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.editarDieta(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .delete("/rebanho/dietas/:id", async (c) => { try { await svc.excluirDieta(Number(c.req.param("id"))); return c.json({ ok: true }); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/dietas/:id/itens", async (c) => { try { return c.json(await svc.listarItensDieta(Number(c.req.param("id")))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .put("/rebanho/dietas/:id/itens", zValidator("json", dietaItensSchema), async (c) => { try { return c.json(await svc.substituirItensDieta(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/lotes", async (c) => c.json(await svc.listarLotes(await resolverEscopoLeitura(c))))
  .get("/rebanho/lotes/:id", async (c) => { try { return c.json(await svc.obterLote(Number(c.req.param("id")), await resolverEscopoLeitura(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .post("/rebanho/lotes", zValidator("json", loteSchema), async (c) => { try { return c.json(await svc.criarLote(c.req.valid("json"), await resolverEscopoEscrita(c)), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/lotes/:id", zValidator("json", loteSchema), async (c) => { try { return c.json(await svc.editarLote(Number(c.req.param("id")), c.req.valid("json"), await resolverEscopoEscrita(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .delete("/rebanho/lotes/:id", async (c) => { try { await svc.excluirLote(Number(c.req.param("id")), await resolverEscopoEscrita(c)); return c.json({ ok: true }); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .post("/rebanho/lotes/:id/dieta", zValidator("json", z.object({ dietaId: z.number().int().nullable() })), async (c) => { try { await svc.atribuirDieta(Number(c.req.param("id")), c.req.valid("json").dietaId, await resolverEscopoEscrita(c)); return c.json({ ok: true }); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/animais-disponiveis", async (c) => c.json(await svc.listarAnimaisDisponiveis(await resolverEscopoLeitura(c))))
  // ── Consumo de dieta → baixa de estoque (Fatia 2) ──────────────────────────
  .get("/rebanho/lotes/:id/consumo/previsao", async (c) => { try { const di = c.req.query("dataInicio") ?? ""; const df = c.req.query("dataFim") ?? ""; return c.json(await consumo.previsaoConsumo(Number(c.req.param("id")), di, df, await resolverEscopoLeitura(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .post("/rebanho/lotes/:id/consumo/fechar", zValidator("json", consumoSchema), async (c) => { try { return c.json(await consumo.fecharConsumoPeriodo(Number(c.req.param("id")), c.req.valid("json"), await resolverEscopoEscrita(c)), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/lotes/:id/consumo", async (c) => { try { return c.json(await consumo.listarConsumosPeriodo(Number(c.req.param("id")), await resolverEscopoLeitura(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .delete("/rebanho/consumo/:id", async (c) => { try { await consumo.reabrirConsumoPeriodo(parseEntityId(c.req.param("id")), await resolverEscopoEscrita(c)); return c.json({ ok: true }); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
