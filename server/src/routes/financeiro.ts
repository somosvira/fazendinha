import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import * as contas from "../services/financeiro/contas.js";
import * as parceiros from "../services/financeiro/parceiros.js";
import * as operacoes from "../services/financeiro/operacoes.js";
import * as documentos from "../services/financeiro/documentos.js";
import * as rascunhos from "../services/financeiro/rascunhos.js";
import { analisarCategorias, analiseCategoriasSchema } from "../services/financeiro/analise-categorias.js";
import { obterDashboard } from "../services/financeiro/dashboard.js";
import { categoriaCadastroSchema, centroCustoSchema, contaSchema, estornoSchema, liquidacaoSchema, operacaoSchema, parceiroSchema, patchCategoriaCadastroSchema, patchCentroCustoSchema, patchContaSchema, patchParceiroSchema, rascunhoOperacaoSchema, tipoDocumentoFinanceiroSchema, transacaoAvulsaSchema, transferenciaSchema } from "../services/financeiro/schemas.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { prisma } from "../db.js";
import { getStorage } from "../lib/storage.js";
import * as cadastros from "../services/financeiro/cadastros-gerenciais.js";
import { exigePermissao } from "../middleware/permissao.js";
import * as relatorios from "../services/financeiro/relatorios.js";
import { configuracaoRelatorioFinanceiroSchema } from "../services/financeiro/relatorios.schemas.js";

function usuarioId(c: Context): number | null {
  const usuario = c.get("usuario") as { id?: number } | undefined;
  return usuario?.id && usuario.id > 0 ? usuario.id : null;
}

function usuarioNome(c: Context): string {
  const usuario = c.get("usuario") as { nome?: string } | undefined;
  return usuario?.nome ?? "Proprietário";
}

function exigirUsuarioId(c: Context): number {
  const id = usuarioId(c);
  if (!id) throw new FinanceiroError("VALIDACAO", "É necessário estar autenticado para salvar um rascunho");
  return id;
}

function falha(c: Context, erro: unknown) {
  if (erro instanceof FinanceiroError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code, ...(erro.campo ? { campo: erro.campo } : {}) }, status);
  }
  console.error("[financeiro]", erro);
  return c.json({ error: "Erro inesperado ao processar a solicitação" }, 500);
}

function validarCadastro<T extends z.ZodTypeAny>(schema: T) {
  return zValidator("json", schema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  });
}

export const financeiroRouter = new Hono()
  .get("/financeiro/configuracoes", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const [contasFinanceiras, parceirosLista, gerenciais, produtos] = await Promise.all([
      contas.listarContas(propriedadeId, true), parceiros.listarParceiros(true),
      cadastros.listarCadastrosGerenciais(),
      prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, unidade: true, estocavel: true, custoUnitario: true, categoriaId: true, centroCustoId: true } }),
    ]);
    return c.json({ contas: contasFinanceiras, parceiros: parceirosLista, ...gerenciais, produtos });
  })
  .post("/financeiro/categorias", exigePermissao("lancar"), validarCadastro(categoriaCadastroSchema), async (c) => {
    try { return c.json(await cadastros.criarCategoria(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/categorias/:id", exigePermissao("lancar"), validarCadastro(patchCategoriaCadastroSchema), async (c) => {
    try { return c.json(await cadastros.atualizarCategoria(Number(c.req.param("id")), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/centros-custo", exigePermissao("lancar"), validarCadastro(centroCustoSchema), async (c) => {
    try { return c.json(await cadastros.criarCentroCusto(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/centros-custo/:id", exigePermissao("lancar"), validarCadastro(patchCentroCustoSchema), async (c) => {
    try { return c.json(await cadastros.atualizarCentroCusto(Number(c.req.param("id")), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/analise-categorias", zValidator("query", analiseCategoriasSchema, (resultado, c) => {
    if (!resultado.success) return c.json({ error: resultado.error.issues[0].message }, 422);
  }), async (c) => {
    try { return c.json(await analisarCategorias(c.req.valid("query"), await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/dashboard", async (c) => {
    const agora = new Date();
    const inicio = c.req.query("inicio") ? new Date(c.req.query("inicio")!) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fim = c.req.query("fim") ? new Date(c.req.query("fim")!) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59));
    return c.json(await obterDashboard(await resolverEscopoLeitura(c), inicio, fim));
  })
  .get("/financeiro/relatorios", async (c) => c.json(await relatorios.listarRelatorios(await resolverEscopoEscrita(c))))
  .get("/financeiro/relatorios/rascunho", async (c) => {
    try { return c.json(await relatorios.obterRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c))); } catch (e) { return falha(c, e); }
  })
  .put("/financeiro/relatorios/rascunho", zValidator("json", z.object({ configuracao: configuracaoRelatorioFinanceiroSchema, versao: z.number().int().positive().optional() })), async (c) => {
    try { const b = c.req.valid("json"); return c.json(await relatorios.salvarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c), b.configuracao, b.versao)); } catch (e) { return falha(c, e); }
  })
  .delete("/financeiro/relatorios/rascunho", async (c) => {
    try { await relatorios.descartarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c)); return c.body(null, 204); } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/relatorios", zValidator("json", configuracaoRelatorioFinanceiroSchema), async (c) => {
    try { return c.json(await relatorios.gerarRelatorio(await resolverEscopoEscrita(c), { id: usuarioId(c), nome: usuarioNome(c) }, c.req.valid("json")), 201); } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/relatorios/:id/download", async (c) => {
    try { const r = await relatorios.baixarRelatorio(Number(c.req.param("id")), await resolverEscopoEscrita(c)); c.header("Content-Type", "application/pdf"); c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(r.nome)}`); return c.body(new Uint8Array(r.buffer)); } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/contas", async (c) => c.json(await contas.listarContas(await resolverEscopoLeitura(c), c.req.query("inativas") === "true")))
  .post("/financeiro/contas", exigePermissao("lancar"), validarCadastro(contaSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await contas.criarConta({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/contas/:id", exigePermissao("lancar"), validarCadastro(patchContaSchema), async (c) => {
    try { return c.json(await contas.atualizarConta(Number(c.req.param("id")), await resolverEscopoEscrita(c), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/extrato-geral", async (c) => {
    try { return c.json(await contas.listarExtratoGeral(await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/contas/:id/extrato", async (c) => {
    try {
      const inicio = c.req.query("inicio") ? new Date(c.req.query("inicio")!) : undefined;
      const fim = c.req.query("fim") ? new Date(c.req.query("fim")!) : undefined;
      return c.json(await contas.listarExtrato(Number(c.req.param("id")), await resolverEscopoLeitura(c), inicio, fim));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/parceiros", async (c) => c.json(await parceiros.listarParceiros(c.req.query("inativos") === "true")))
  .post("/financeiro/parceiros", exigePermissao("lancar"), validarCadastro(parceiroSchema), async (c) => {
    try { return c.json(await parceiros.criarParceiro({ ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/parceiros/:id", exigePermissao("lancar"), validarCadastro(patchParceiroSchema), async (c) => {
    try { return c.json(await parceiros.atualizarParceiro(Number(c.req.param("id")), c.req.valid("json"), usuarioId(c))); }
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
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) return c.json({ error: "Salve o rascunho antes de anexar documentos" }, 409);
      return c.json(await documentos.anexarDocumentoRascunho({
        rascunhoId: rascunho.id, propriedadeId, usuarioId: uid, tipo: tipo.data,
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
      await documentos.removerDocumentoRascunho(Number(c.req.param("id")), rascunho.id, propriedadeId, uid);
      return c.body(null, 204);
    } catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/operacoes/rascunho/documentos/:id", zValidator("json", z.object({ tipo: tipoDocumentoFinanceiroSchema.optional(), numero: z.string().max(80).nullable().optional() })), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
      return c.json(await documentos.atualizarDocumentoRascunho(Number(c.req.param("id")), rascunho.id, propriedadeId, uid, c.req.valid("json")));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes/:id", async (c) => {
    try { return c.json(await operacoes.obterOperacao(Number(c.req.param("id")), await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes", zValidator("json", operacaoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await operacoes.criarOperacao({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/estorno", zValidator("json", estornoSchema), async (c) => {
    try { return c.json(await operacoes.estornarOperacao(Number(c.req.param("id")), c.req.valid("json").motivo, usuarioId(c)), 201); }
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
      const propriedadeId = await resolverEscopoEscrita(c);
      const documento = await documentos.anexarDocumentoOperacao({
        operacaoId: Number(c.req.param("id")), propriedadeId, tipo: tipo.data,
        nome: String(form.get("nome") || arquivo.name), numero: String(form.get("numero") || "") || null,
        mimeType: arquivo.type || "application/octet-stream", buffer: Buffer.from(await arquivo.arrayBuffer()), usuarioId: usuarioId(c),
      });
      return c.json(documento, 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/documentos/:id/download", async (c) => {
    try {
      const documento = await documentos.obterDocumento(Number(c.req.param("id")), await resolverEscopoEscrita(c));
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
    try { return c.json(await operacoes.liquidarCompromisso(Number(c.req.param("id")), { ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
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
  .post("/financeiro/transacoes/:id/estorno", zValidator("json", estornoSchema), async (c) => {
    try { return c.json(await operacoes.estornarTransacao(Number(c.req.param("id")), c.req.valid("json").motivo, usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  });
