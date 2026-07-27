import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  resolverEscopoEscrita,
  resolverEscopoLeitura,
} from "../../services/propriedade.js";
import {
  criarPlanoAcasalamentoSchema,
  escolherReprodutorPlanoSchema,
} from "../../services/rebanho/planos-acasalamento.schemas.js";
import * as svc from "../../services/rebanho/planos-acasalamento.js";

function fail(error: unknown): {
  status: 404 | 409 | 500;
  body: { error: string };
} {
  if (error instanceof svc.PlanoAcasalamentoError) {
    return {
      status: error.code === "NAO_ENCONTRADO" ? 404 : 409,
      body: { error: error.message },
    };
  }
  console.error("[planos-acasalamento]", error);
  return {
    status: 500,
    body: { error: "Erro inesperado ao processar. Tente novamente." },
  };
}

function idPositivo(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function exigirId(raw: string, mensagem: string): number {
  const id = idPositivo(raw);
  if (id == null) {
    throw new svc.PlanoAcasalamentoError("NAO_ENCONTRADO", mensagem);
  }
  return id;
}

export const planosAcasalamentoRouter = new Hono()
  .get("/rebanho/acasalamento/planos", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.listarPlanosAcasalamento(propriedadeId));
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .post(
    "/rebanho/acasalamento/planos",
    zValidator("json", criarPlanoAcasalamentoSchema),
    async (c) => {
      try {
        const propriedadeId = await resolverEscopoEscrita(c);
        return c.json(
          await svc.criarPlanoAcasalamento(
            c.req.valid("json"),
            propriedadeId,
          ),
          201,
        );
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  )
  .get("/rebanho/acasalamento/planos/:id", async (c) => {
    try {
      const id = exigirId(c.req.param("id"), "plano não encontrado");
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await svc.obterPlanoAcasalamento(id, propriedadeId));
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .post("/rebanho/acasalamento/planos/:id/recalcular", async (c) => {
    try {
      const id = exigirId(c.req.param("id"), "plano não encontrado");
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await svc.recalcularPlanoAcasalamento(id, propriedadeId));
    } catch (error) {
      const { status, body } = fail(error);
      return c.json(body, status);
    }
  })
  .patch(
    "/rebanho/acasalamento/linhas/:id/escolha",
    zValidator("json", escolherReprodutorPlanoSchema),
    async (c) => {
      try {
        const id = exigirId(c.req.param("id"), "linha do plano não encontrada");
        const propriedadeId = await resolverEscopoEscrita(c);
        return c.json(
          await svc.escolherReprodutorPlano(
            id,
            c.req.valid("json"),
            propriedadeId,
          ),
        );
      } catch (error) {
        const { status, body } = fail(error);
        return c.json(body, status);
      }
    },
  );
