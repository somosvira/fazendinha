import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { camposParaTemplate } from "../../services/rebanho/formularios.campos.js";
import * as folhas from "../../services/rebanho/formularios.folhas.js";
import * as modelos from "../../services/rebanho/formularios.modelos.js";
import {
  atualizarLinhasFolhaSchema,
  criarFolhaCampoSchema,
  criarModeloFormularioSchema,
  editarModeloFormularioSchema,
  listarFolhasQuerySchema,
} from "../../services/rebanho/formularios.schemas.js";
import { IDS_TEMPLATE_RELATORIO } from "../../services/rebanho/relatorios.catalogo.js";
import { z } from "zod";

const templateQuerySchema = z.object({ templateId: z.enum(IDS_TEMPLATE_RELATORIO).optional() });

function id(raw: string): number {
  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor <= 0) throw new folhas.FormularioFolhaError("NAO_ENCONTRADO", "registro não encontrado");
  return valor;
}

function erro(error: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (error instanceof folhas.FormularioFolhaError || error instanceof modelos.ModeloFormularioError) {
    return { status: (error as any).code === "NAO_ENCONTRADO" ? 404 : 409, body: { error: error.message } };
  }
  console.error("[formularios-campo]", error);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

export const formulariosRouter = new Hono()
  .get("/rebanho/formularios/campos", zValidator("query", templateQuerySchema.required()), (c) =>
    c.json(camposParaTemplate(c.req.valid("query").templateId)))
  .get("/rebanho/formularios/modelos", zValidator("query", templateQuerySchema), async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await modelos.listarModelosFormulario(propriedadeId, c.req.valid("query").templateId));
  })
  .post("/rebanho/formularios/modelos", zValidator("json", criarModeloFormularioSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await modelos.criarModeloFormulario(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .patch("/rebanho/formularios/modelos/:id", zValidator("json", editarModeloFormularioSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await modelos.editarModeloFormulario(id(c.req.param("id")), c.req.valid("json"), propriedadeId));
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .delete("/rebanho/formularios/modelos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      await modelos.excluirModeloFormulario(id(c.req.param("id")), propriedadeId);
      return c.json({ ok: true });
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .get("/rebanho/formularios/folhas", zValidator("query", listarFolhasQuerySchema), async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await folhas.listarFolhasCampo(propriedadeId, c.req.valid("query").status));
  })
  .post("/rebanho/formularios/folhas", zValidator("json", criarFolhaCampoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await folhas.criarFolhaCampo(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .get("/rebanho/formularios/folhas/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await folhas.obterFolhaCampo(id(c.req.param("id")), propriedadeId));
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .patch("/rebanho/formularios/folhas/:id/linhas", zValidator("json", atualizarLinhasFolhaSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await folhas.salvarLinhasFolha(id(c.req.param("id")), c.req.valid("json"), propriedadeId));
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .post("/rebanho/formularios/folhas/:id/concluir", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await folhas.concluirFolhaCampo(id(c.req.param("id")), propriedadeId));
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  })
  .post("/rebanho/formularios/folhas/:id/cancelar", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await folhas.cancelarFolhaCampo(id(c.req.param("id")), propriedadeId));
    } catch (e) { const falha = erro(e); return c.json(falha.body, falha.status); }
  });
