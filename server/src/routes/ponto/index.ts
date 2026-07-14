import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as func from "../../services/ponto/funcionarios.js";
import * as pontos from "../../services/ponto/pontos.js";
import { custoMOPorSetor } from "../../services/ponto/custoMOSetor.js";
import { apurarFolha } from "../../services/ponto/folha.service.js";
import { FuncionarioError } from "../../services/ponto/funcionarios.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { exigePermissao } from "../../middleware/permissao.js";
import {
  criarFuncionarioSchema,
  editarFuncionarioSchema,
  listFuncionariosSchema,
} from "../../services/ponto/funcionarios.schemas.js";
import {
  listRegistrosSchema,
  upsertRegistroSchema,
  folhaMesSchema,
  preencherGradeSchema,
} from "../../services/ponto/pontos.schemas.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof FuncionarioError) {
    const map = { NAO_ENCONTRADO: 404 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  console.error("[ponto]", err);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico → 404 antes de chamar o Prisma (que jogaria 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/* Módulo Equipe & Ponto (RH leve). Persistência via Prisma. */
export const pontoRouter = new Hono()
  // ── Funcionários ──────────────────────────────────────────────────────────
  .get("/ponto/funcionarios", zValidator("query", listFuncionariosSchema), async (c) =>
    c.json(await func.listarFuncionarios(c.req.valid("query"), await resolverEscopoLeitura(c)))
  )
  // Custo de mão de obra por setor (só ativos; sem setor → "Geral"; total desc).
  // Número disponível para a gestão — NÃO amarrado ainda ao custo dos módulos
  // (rebanho/plantio/corte têm custo próprio). Vem antes de "/:id" p/ não colidir.
  .get("/ponto/custo-mo-setor", async (c) => c.json(await custoMOPorSetor(await resolverEscopoLeitura(c))))
  .get("/ponto/funcionarios/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    const dto = await func.obterFuncionario(id);
    return dto ? c.json(dto) : c.json({ error: "funcionário não encontrado" }, 404);
  })
  .post("/ponto/funcionarios", zValidator("json", criarFuncionarioSchema), async (c) => {
    try {
      return c.json(await func.criarFuncionario(c.req.valid("json"), await resolverEscopoEscrita(c)), 201);
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .patch("/ponto/funcionarios/:id", zValidator("json", editarFuncionarioSchema), async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await func.editarFuncionario(id, c.req.valid("json")));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .post("/ponto/funcionarios/:id/baixa", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await func.baixarFuncionario(id));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  // Pré-preenche a grade do mês com o horário padrão do funcionário (dias úteis
  // ainda vazios). Idempotente — reenviar não duplica. Sem padrão → criados: 0.
  .post(
    "/ponto/funcionarios/:id/preencher-grade",
    zValidator("json", preencherGradeSchema),
    async (c) => {
      const id = parseId(c.req.param("id"));
      if (id == null) return c.json({ error: "id inválido" }, 404);
      try {
        const { ano, mes } = c.req.valid("json");
        return c.json(await pontos.preencherGradePadrao(id, ano, mes));
      } catch (e) {
        const { status, body } = handle(e);
        return c.json(body, status);
      }
    }
  )
  // ── Registros de ponto ────────────────────────────────────────────────────
  .get("/ponto/registros", zValidator("query", listRegistrosSchema), async (c) => {
    const { funcionarioId, mes } = c.req.valid("query");
    try {
      return c.json(await pontos.listarRegistros(funcionarioId, mes));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .post("/ponto/registros", zValidator("json", upsertRegistroSchema), async (c) => {
    try {
      return c.json(await pontos.upsertRegistro(c.req.valid("json")));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  .delete("/ponto/registros/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      await pontos.excluirRegistro(id);
      return c.json({ ok: true });
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  })
  // ── Folha ─────────────────────────────────────────────────────────────────
  .get("/ponto/folha", exigePermissao("verSalarios"), zValidator("query", folhaMesSchema), async (c) => {
    try {
      return c.json(await apurarFolha(c.req.valid("query").mes, await resolverEscopoLeitura(c)));
    } catch (e) {
      const { status, body } = handle(e);
      return c.json(body, status);
    }
  });
