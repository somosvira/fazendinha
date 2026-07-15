import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarAnimalSchema, editarAnimalSchema, baixaSchema, listFiltrosSchema } from "../../services/rebanho/animais.schemas.js";
import * as svc from "../../services/rebanho/animais.js";
import { obterInsights } from "../../services/rebanho/insights.js";
import { listarLactacoes } from "../../services/rebanho/lactacoes.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.AnimalError) {
    const map = { NAO_ENCONTRADO: 404, NUMERO_DUPLICADO: 409, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  // erro inesperado (Prisma, runtime, etc.): loga internamente e devolve msg amigável
  console.error("[animais]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const animaisRouter = new Hono()
  .get("/rebanho/grupos", async (c) => c.json(await svc.listarGrupos()))
  .get("/rebanho/racas", async (c) => c.json(await svc.listarRacas()))
  .get("/rebanho/setores", async (c) => c.json(await svc.listarSetores()))
  .get("/rebanho/animais", zValidator("query", listFiltrosSchema), async (c) => {
    // Escopo de leitura: 1 sítio → principal (invisível); N sem filtro → consolidado.
    const escopo = await resolverEscopoLeitura(c);
    return c.json(await svc.listarAnimais({ ...c.req.valid("query"), propriedadeId: escopo ?? undefined }));
  })
  .get("/rebanho/animais/:id", async (c) => {
    const dto = await svc.obterAnimal(Number(c.req.param("id")));
    return dto ? c.json(dto) : c.json({ error: "animal não encontrado" }, 404);
  })
  .get("/rebanho/animais/:id/insights", async (c) => {
    const dto = await obterInsights(Number(c.req.param("id")));
    return dto ? c.json(dto) : c.json({ error: "animal não encontrado" }, 404);
  })
  .get("/rebanho/animais/:id/lactacoes", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "id inválido" }, 400);
    await resolverEscopoLeitura(c);
    return c.json(await listarLactacoes(id));
  })
  .post("/rebanho/animais", zValidator("json", criarAnimalSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      // Cria no sítio explícito do payload → sítio ativo (header/query) → principal.
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await svc.criarAnimal({ ...input, propriedadeId }), 201);
    }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/rebanho/animais/:id", zValidator("json", editarAnimalSchema), async (c) => {
    try { return c.json(await svc.editarAnimal(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/rebanho/animais/:id/baixa", zValidator("json", baixaSchema), async (c) => {
    try { return c.json(await svc.darBaixa(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
