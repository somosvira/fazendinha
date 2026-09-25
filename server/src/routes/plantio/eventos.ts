import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarOperacaoSchema, editarOperacaoSchema } from "../../services/plantio/schemas.js";
import { montarTimeline, criarOperacao, editarOperacao, excluirOperacao, PlantioEventoError } from "../../services/plantio/timeline.js";
import { prisma } from "../../db.js";
import { resolverEscopoEscrita } from "../../services/propriedade.js";
import { getUsuario } from "../../middleware/permissao.js";

function handle(err: unknown): { status: 404 | 409 | 422 | 500; body: { error: string } } {
  if (err instanceof PlantioEventoError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409, VALIDACAO: 422 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[plantio/eventos]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ex.: /talhoes/abc/eventos) → 404 antes de chamar o Prisma.
// Aceita também o formato "op-<n>" usado pela timeline tecida (EventoTimeline.id).
const parseId = (raw: string): number | null => {
  const semPrefixo = raw.startsWith("op-") ? raw.slice(3) : raw;
  const id = Number(semPrefixo);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Confere que a operação pertence ao sítio resolvido pelo escopo de escrita
// (header X-Propriedade-Id / query) antes de editar/excluir.
async function assertEscopo(c: Parameters<typeof resolverEscopoEscrita>[0], operacaoId: number): Promise<boolean> {
  const escopo = await resolverEscopoEscrita(c);
  const operacao = await prisma.operacaoAgricola.findUnique({
    where: { id: operacaoId },
    select: { talhao: { select: { propriedadeId: true } } },
  });
  if (!operacao) return true; // deixa o service devolver NAO_ENCONTRADO
  return operacao.talhao.propriedadeId == null || operacao.talhao.propriedadeId === escopo;
}

// Timeline tecida do talhão (5 tabelas → 1 DTO) + registro de operação.
export const plantioEventosRouter = new Hono()
  .get("/plantio/talhoes/:id/eventos", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    return c.json(await montarTimeline(id));
  })
  .post("/plantio/talhoes/:id/operacoes", zValidator("json", criarOperacaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await criarOperacao(id, c.req.valid("json"), getUsuario(c)?.id ?? null), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .patch("/plantio/operacoes/:id", zValidator("json", editarOperacaoSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    if (!(await assertEscopo(c, id))) return c.json({ error: "operação não encontrada" }, 404);
    try {
      return c.json(await editarOperacao(id, c.req.valid("json"), getUsuario(c)?.id ?? null));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .delete("/plantio/operacoes/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    if (!(await assertEscopo(c, id))) return c.json({ error: "operação não encontrada" }, 404);
    try {
      await excluirOperacao(id, getUsuario(c)?.id ?? null);
      return c.body(null, 204);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  });
