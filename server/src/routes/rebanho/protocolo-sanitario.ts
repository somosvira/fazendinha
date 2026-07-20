import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarProtocoloSanitarioSchema, atualizarProtocoloSanitarioSchema, aplicarProtocoloSanitarioSchema } from "../../services/rebanho/protocolo-sanitario.schemas.js";
import * as svc from "../../services/rebanho/protocolo-sanitario.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.ProtocoloSanitarioError) return { status: e.code === "PROTOCOLO_INATIVO" ? 409 : 404, body: { error: e.message } };
  console.error("[protocolo-sanitario]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const protocoloSanitarioRouter = new Hono()
  .get("/rebanho/protocolos-sanitarios", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const incluirInativos = c.req.query("inativos") === "1";
    return c.json(await svc.listarProtocolos(propriedadeId, incluirInativos));
  })
  .post("/rebanho/protocolos-sanitarios", zValidator("json", criarProtocoloSanitarioSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.criarProtocolo(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .patch("/rebanho/protocolos-sanitarios/:id", zValidator("json", atualizarProtocoloSanitarioSchema), async (c) => {
    try { return c.json(await svc.atualizarProtocolo(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .delete("/rebanho/protocolos-sanitarios/:id", async (c) => {
    try { await svc.excluirProtocolo(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  // aplicações (a rota de aplicação/:id vem antes da de animais p/ não colidir no param)
  .delete("/rebanho/protocolos-sanitarios/aplicacoes/:id", async (c) => {
    try { await svc.excluirAplicacao(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/rebanho/animais/:id/protocolo-sanitario", async (c) => c.json(await svc.listarAplicacoes(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/protocolo-sanitario", zValidator("json", aplicarProtocoloSanitarioSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.aplicarProtocolo(Number(c.req.param("id")), c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  });
