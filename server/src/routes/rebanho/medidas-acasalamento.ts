import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ZodError } from "zod";
import {
  atualizarCombinacaoMedidaSchema,
  atualizarMedidaAcasalamentoSchema,
  criarCombinacaoMedidaSchema,
  criarMedidaAcasalamentoSchema,
} from "../../services/rebanho/medidas-acasalamento.schemas.js";
import * as svc from "../../services/rebanho/medidas-acasalamento.js";

function fail(error: unknown): { status: 400 | 404 | 409 | 500; body: { error: string } } {
  if (error instanceof svc.MedidaAcasalamentoError) {
    return {
      status: error.code === "NAO_ENCONTRADO" ? 404 : 409,
      body: { error: error.message },
    };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { error: error.issues[0]?.message ?? "Configuração inválida." } };
  }
  console.error("[medidas-acasalamento]", error);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

function idPositivo(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const medidasAcasalamentoRouter = new Hono()
  .get("/rebanho/acasalamento/medidas", async (c) => {
    try {
      return c.json(await svc.listarMedidasAcasalamento(c.req.query("inativas") === "1"));
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .post(
    "/rebanho/acasalamento/medidas",
    zValidator("json", criarMedidaAcasalamentoSchema),
    async (c) => {
      try {
        return c.json(await svc.criarMedidaAcasalamento(c.req.valid("json")), 201);
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  )
  .patch(
    "/rebanho/acasalamento/medidas/:id",
    zValidator("json", atualizarMedidaAcasalamentoSchema),
    async (c) => {
      try {
        const id = idPositivo(c.req.param("id"));
        if (id == null) throw new svc.MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");
        return c.json(await svc.atualizarMedidaAcasalamento(id, c.req.valid("json")));
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  )
  .delete("/rebanho/acasalamento/medidas/:id", async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");
      await svc.excluirMedidaAcasalamento(id);
      return c.json({ ok: true });
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .get("/rebanho/acasalamento/combinacoes", async (c) => {
    try {
      return c.json(await svc.listarCombinacoesMedida(c.req.query("inativas") === "1"));
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .post(
    "/rebanho/acasalamento/combinacoes",
    zValidator("json", criarCombinacaoMedidaSchema),
    async (c) => {
      try {
        return c.json(await svc.criarCombinacaoMedida(c.req.valid("json")), 201);
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  )
  .patch(
    "/rebanho/acasalamento/combinacoes/:id",
    zValidator("json", atualizarCombinacaoMedidaSchema),
    async (c) => {
      try {
        const id = idPositivo(c.req.param("id"));
        if (id == null) throw new svc.MedidaAcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
        return c.json(await svc.atualizarCombinacaoMedida(id, c.req.valid("json")));
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  )
  .delete("/rebanho/acasalamento/combinacoes/:id", async (c) => {
    try {
      const id = idPositivo(c.req.param("id"));
      if (id == null) throw new svc.MedidaAcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
      await svc.excluirCombinacaoMedida(id);
      return c.json({ ok: true });
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  });
