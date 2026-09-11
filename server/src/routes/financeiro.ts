import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import * as contas from "../services/financeiro/contas.js";
import * as parceiros from "../services/financeiro/parceiros.js";
import * as operacoes from "../services/financeiro/operacoes.js";
import * as documentos from "../services/financeiro/documentos.js";
import * as rascunhos from "../services/financeiro/rascunhos.js";
import { obterDashboard } from "../services/financeiro/dashboard.js";
import { contaSchema, estornoOperacaoSchema, estornoTransacaoSchema, liquidacaoSchema, operacaoSchema, parceiroSchema, rascunhoOperacaoSchema, tipoDocumentoFinanceiroSchema, transacaoAvulsaSchema, transferenciaSchema } from "../services/financeiro/schemas.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { prisma } from "../db.js";
import { getStorage } from "../lib/storage.js";
import { entityIdSchema } from "@fazendinha/shared";
import { EntityIdError, parseEntityId } from "../lib/ids.js";

function usuarioId(c: Context): number | null {
  const usuario = c.get("usuario") as { id?: number } | undefined;
  return usuario?.id && usuario.id > 0 ? usuario.id : null;
}

function exigirUsuarioId(c: Context): number {
  const id = usuarioId(c);
  if (!id) throw new FinanceiroError("VALIDACAO", "É necessário estar autenticado para salvar um rascunho");
  return id;
}

function falha(c: Context, erro: unknown) {
  if (erro instanceof EntityIdError) return c.json({ error: erro.message }, 400);
  if (erro instanceof FinanceiroError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code }, status);
  }
  console.error("[financeiro]", erro);
  return c.json({ error: "Erro inesperado ao processar a solicitação" }, 500);
}

const patchContaSchema = contaSchema.pick({ nome: true, instituicao: true, identificacao: true, incluirNoSaldoGeral: true }).partial().extend({ ativo: z.boolean().optional() });
const patchParceiroSchema = parceiroSchema.omit({ id: true }).partial().extend({ ativo: z.boolean().optional() });

export const financeiroRouter = new Hono()
  .get("/financeiro/configuracoes", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const [contasFinanceiras, parceirosLista, gruposCategorias, centrosCusto, produtos] = await Promise.all([
      contas.listarContas(propriedadeId, true), parceiros.listarParceiros(true),
      prisma.grupoCategoria.findMany({ include: { categorias: { orderBy: { nome: "asc" } } }, orderBy: { ordem: "asc" } }),
      prisma.centroCusto.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
      prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, unidade: true, estocavel: true, custoUnitario: true } }),
    ]);
    return c.json({ contas: contasFinanceiras, parceiros: parceirosLista, gruposCategorias, centrosCusto, produtos });
  })
  .get("/financeiro/dashboard", async (c) => {
    const agora = new Date();
    const inicio = c.req.query("inicio") ? new Date(c.req.query("inicio")!) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fim = c.req.query("fim") ? new Date(c.req.query("fim")!) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59));
    return c.json(await obterDashboard(await resolverEscopoLeitura(c), inicio, fim));
  })
  .get("/financeiro/contas", async (c) => c.json(await contas.listarContas(await resolverEscopoLeitura(c), c.req.query("inativas") === "true")))
  .post("/financeiro/contas", zValidator("json", contaSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await contas.criarConta({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/contas/:id", zValidator("json", patchContaSchema), async (c) => {
    try { return c.json(await contas.atualizarConta(parseEntityId(c.req.param("id")), await resolverEscopoEscrita(c), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/contas/:id/extrato", async (c) => {
    try {
      const inicio = c.req.query("inicio") ? new Date(c.req.query("inicio")!) : undefined;
      const fim = c.req.query("fim") ? new Date(c.req.query("fim")!) : undefined;
      return c.json(await contas.listarExtrato(parseEntityId(c.req.param("id")), await resolverEscopoEscrita(c), inicio, fim));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/parceiros", async (c) => c.json(await parceiros.listarParceiros(c.req.query("inativos") === "true")))
  .post("/financeiro/parceiros", zValidator("json", parceiroSchema), async (c) => {
    try { return c.json(await parceiros.criarParceiro({ ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/parceiros/:id", zValidator("json", patchParceiroSchema), async (c) => {
    try { return c.json(await parceiros.atualizarParceiro(parseEntityId(c.req.param("id")), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes", async (c) => {
    const inicio = c.req.query("inicio") ? new Date(`${c.req.query("inicio")}T00:00:00`) : undefined;
    const fim = c.req.query("fim") ? new Date(`${c.req.query("fim")}T00:00:00`) : undefined;
    return c.json(await operacoes.listarOperacoes(await resolverEscopoLeitura(c), inicio, fim));
  })
  .get("/financeiro/operacoes/rascunho", async (c) => {
    try { return c.json(await rascunhos.obterRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .put("/financeiro/operacoes/rascunho", zValidator("json", rascunhoOperacaoSchema), async (c) => {
    try {
      return c.json(await rascunhos.salvarRascunho({
        ...c.req.valid("json"), propriedadeId: await resolverEscopoEscrita(c), usuarioId: exigirUsuarioId(c),
      }));
    } catch (e) { return falha(c, e); }
  })
  .delete("/financeiro/operacoes/rascunho", async (c) => {
    try { await rascunhos.descartarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c)); return c.body(null, 204); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/rascunho/confirmacao", zValidator("json", z.object({ versao: z.number().int().positive().optional() })), async (c) => {
    try { return c.json(await rascunhos.confirmarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c), c.req.valid("json").versao), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/rascunho/documentos", async (c) => {
    try {
      const form = await c.req.formData();
      const arquivo = form.get("arquivo");
      if (!(arquivo instanceof File)) return c.json({ error: "Selecione um arquivo" }, 400);
      const tipo = tipoDocumentoFinanceiroSchema.safeParse(form.get("tipo"));
      if (!tipo.success) return c.json({ error: "Tipo de documento inválido" }, 422);
      const id = entityIdSchema.safeParse(form.get("id"));
      if (!id.success) return c.json({ error: "ID de documento inválido" }, 400);
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) return c.json({ error: "Salve o rascunho antes de anexar documentos" }, 409);
      return c.json(await documentos.anexarDocumentoRascunho({
        id: id.data, rascunhoId: rascunho.id, propriedadeId, usuarioId: uid, tipo: tipo.data,
        nome: String(form.get("nome") || arquivo.name), numero: String(form.get("numero") || "") || null,
        mimeType: arquivo.type || "application/octet-stream", buffer: Buffer.from(await arquivo.arrayBuffer()),
      }), 201);
    } catch (e) { return falha(c, e); }
  })
  .delete("/financeiro/operacoes/rascunho/documentos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
      await documentos.removerDocumentoRascunho(parseEntityId(c.req.param("id")), rascunho.id, propriedadeId, uid);
      return c.body(null, 204);
    } catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/operacoes/rascunho/documentos/:id", zValidator("json", z.object({ tipo: tipoDocumentoFinanceiroSchema.optional(), numero: z.string().max(80).nullable().optional() })), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
      return c.json(await documentos.atualizarDocumentoRascunho(parseEntityId(c.req.param("id")), rascunho.id, propriedadeId, uid, c.req.valid("json")));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes/:id", async (c) => {
    try { return c.json(await operacoes.obterOperacao(parseEntityId(c.req.param("id")), await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes", zValidator("json", operacaoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await operacoes.criarOperacao({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/estorno", zValidator("json", estornoOperacaoSchema), async (c) => {
    try { const input = c.req.valid("json"); return c.json(await operacoes.estornarOperacao(parseEntityId(c.req.param("id")), input.motivo, input.transacoes, usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/documentos", async (c) => {
    try {
      const contentLength = Number(c.req.header("content-length") ?? 0);
      if (contentLength > documentos.MAX_DOCUMENTO_BYTES + 64 * 1024) {
        return c.json({ error: "O arquivo excede o limite de 10 MB" }, 413);
      }
      const form = await c.req.formData();
      const arquivo = form.get("arquivo");
      if (!(arquivo instanceof File)) return c.json({ error: "Selecione um arquivo" }, 400);
      const tipo = tipoDocumentoFinanceiroSchema.safeParse(form.get("tipo"));
      if (!tipo.success) return c.json({ error: "Tipo de documento inválido" }, 422);
      const id = entityIdSchema.safeParse(form.get("id"));
      if (!id.success) return c.json({ error: "ID de documento inválido" }, 400);
      const propriedadeId = await resolverEscopoEscrita(c);
      const documento = await documentos.anexarDocumentoOperacao({
        id: id.data, operacaoId: parseEntityId(c.req.param("id")), propriedadeId, tipo: tipo.data,
        nome: String(form.get("nome") || arquivo.name), numero: String(form.get("numero") || "") || null,
        mimeType: arquivo.type || "application/octet-stream", buffer: Buffer.from(await arquivo.arrayBuffer()), usuarioId: usuarioId(c),
      });
      return c.json(documento, 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/documentos/:id/download", async (c) => {
    try {
      const documento = await documentos.obterDocumento(parseEntityId(c.req.param("id")), await resolverEscopoEscrita(c));
      const storage = await getStorage();
      if (storage.driver === "r2") {
        return c.redirect(await storage.getSignedDownloadUrl({ key: documento.storageKey!, filename: documento.nome }));
      }
      const buffer = await storage.getObjectBuffer({ key: documento.storageKey! });
      c.header("Content-Type", documento.mimeType || "application/octet-stream");
      c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(documento.nome)}`);
      c.header("Cache-Control", "private, max-age=300");
      return c.body(new Uint8Array(buffer));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/compromissos", async (c) => c.json(await operacoes.listarCompromissos(await resolverEscopoLeitura(c))))
  .post("/financeiro/compromissos/:id/liquidacoes", zValidator("json", liquidacaoSchema), async (c) => {
    try { return c.json(await operacoes.liquidarCompromisso(parseEntityId(c.req.param("id")), { ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/transferencias", zValidator("json", transferenciaSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await operacoes.transferir({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/transacoes", zValidator("json", transacaoAvulsaSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await operacoes.criarTransacaoAvulsa({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/transacoes/:id/estorno", zValidator("json", estornoTransacaoSchema), async (c) => {
    try { return c.json(await operacoes.estornarTransacao(parseEntityId(c.req.param("id")), c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  });
