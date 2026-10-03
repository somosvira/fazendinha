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
import { categoriaCadastroSchema, centroCustoSchema, contaSchema, estornoSchema, liquidacaoSchema, operacaoSchema, parceiroSchema, patchCategoriaCadastroSchema, patchCentroCustoSchema, patchContaSchema, patchParceiroSchema, rascunhoOperacaoSchema, simulacaoParcelasSchema, tipoDocumentoFinanceiroSchema, transacaoAvulsaSchema, transferenciaSchema } from "../services/financeiro/schemas.js";
import { patchProdutoSchema, produtoSchema } from "../services/estoque/produtos.schemas.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { getStorage } from "../lib/storage.js";
import * as cadastros from "../services/financeiro/cadastros-gerenciais.js";
import * as produtos from "../services/estoque/produtos.js";
import { exigePermissao, getUsuario } from "../middleware/permissao.js";
import { prisma } from "../db.js";
import { obterCentrosAtividade } from "../services/estoque/centros-atividade.js";
import { listarOrigemFinanceira } from "../services/pecuaria/sanidade/origem-financeira.js";
import { temArea, temPermissao } from "../services/auth/papeis.js";

export const filtroPeriodoSchema = z.object({ inicio: z.string().date().optional(), fim: z.string().date().optional() }).refine(p => (!p.inicio && !p.fim) || (!!p.inicio && !!p.fim && p.inicio <= p.fim), { message: "Informe um intervalo válido, com início igual ou anterior ao fim." });
const validarPeriodo = zValidator("query", filtroPeriodoSchema, (resultado, c) => { if (!resultado.success) return c.json({ error: resultado.error.issues[0].message }, 422); });

const uploadIntentSchema = z.object({
  tipo: tipoDocumentoFinanceiroSchema,
  nome: z.string().max(180),
  numero: z.string().max(80).nullable().optional(),
  mimeType: z.string().max(120),
  tamanhoBytes: z.number().int().positive(),
  sha256: z.string().length(64),
});
const uploadConfirmacaoSchema = z.object({ uploadToken: z.string().min(20) });

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
      return c.json({ error: erro.message, code: "VALIDACAO", campo: erro.path.join(".") }, 422);
    }
  });
}

export const financeiroRouter = new Hono()
  .get("/financeiro/configuracoes", async (c) => {
    const propriedadeId = await resolverEscopoLeitura(c);
    const [contasFinanceiras, parceirosLista, gerenciais, produtosCadastro, centrosAtividade] = await Promise.all([
      contas.listarContas(propriedadeId, true), parceiros.listarParceiros(true),
      cadastros.listarCadastrosGerenciais(),
      produtos.listarProdutosCadastro(),
      obterCentrosAtividade(prisma),
    ]);
    const produtosAtivos = produtosCadastro.filter((p) => p.ativo);
    return c.json({
      contas: contasFinanceiras, parceiros: parceirosLista, ...gerenciais,
      produtos: produtosAtivos, produtosCadastro,
      centrosAtividade,
    });
  })
  .post("/financeiro/produtos", exigePermissao("lancar"), validarCadastro(produtoSchema), async (c) => {
    try { return c.json(await produtos.criarProduto(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/produtos/:id", exigePermissao("lancar"), validarCadastro(patchProdutoSchema), async (c) => {
    try { return c.json(await produtos.atualizarProduto(c.req.param("id"), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/categorias", exigePermissao("lancar"), validarCadastro(categoriaCadastroSchema), async (c) => {
    try { return c.json(await cadastros.criarCategoria(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/categorias/:id", exigePermissao("lancar"), validarCadastro(patchCategoriaCadastroSchema), async (c) => {
    try { return c.json(await cadastros.atualizarCategoria(c.req.param("id"), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/centros-custo", exigePermissao("lancar"), validarCadastro(centroCustoSchema), async (c) => {
    try { return c.json(await cadastros.criarCentroCusto(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/centros-custo/:id", exigePermissao("lancar"), validarCadastro(patchCentroCustoSchema), async (c) => {
    try { return c.json(await cadastros.atualizarCentroCusto(c.req.param("id"), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/analise-categorias", zValidator("query", analiseCategoriasSchema, (resultado, c) => {
    if (!resultado.success) return c.json({ error: resultado.error.issues[0].message }, 422);
  }), async (c) => {
    try { return c.json(await analisarCategorias(c.req.valid("query"), await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/dashboard", validarPeriodo, async (c) => {
    const agora = new Date();
    const periodo = c.req.valid("query");
    const inicio = periodo.inicio ? new Date(`${periodo.inicio}T00:00:00Z`) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fim = periodo.fim ? new Date(`${periodo.fim}T23:59:59.999Z`) : new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    try { return c.json(await obterDashboard(await resolverEscopoLeitura(c), inicio, fim)); }
    catch (e) { return falha(c, e); }
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
    try { return c.json(await contas.atualizarConta(c.req.param("id"), await resolverEscopoEscrita(c), c.req.valid("json"), usuarioId(c))); }
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
      return c.json(await contas.listarExtrato(c.req.param("id"), await resolverEscopoLeitura(c), inicio, fim));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/parceiros", async (c) => c.json(await parceiros.listarParceiros(c.req.query("inativos") === "true")))
  .post("/financeiro/parceiros", exigePermissao("lancar"), validarCadastro(parceiroSchema), async (c) => {
    try { return c.json(await parceiros.criarParceiro({ ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/parceiros/:id", exigePermissao("lancar"), validarCadastro(patchParceiroSchema), async (c) => {
    try { return c.json(await parceiros.atualizarParceiro(c.req.param("id"), c.req.valid("json"), usuarioId(c))); }
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
  .post("/financeiro/operacoes/simulacao-parcelas", exigePermissao("lancar"), validarCadastro(simulacaoParcelasSchema), async (c) => {
    try { return c.json(operacoes.simularParcelas(c.req.valid("json"))); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/rascunho/documentos/intencao", zValidator("json", uploadIntentSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) return c.json({ error: "Salve o rascunho antes de anexar documentos" }, 409);
      return c.json(await documentos.solicitarUploadRascunho(rascunho.id, propriedadeId, uid, c.req.valid("json")), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/rascunho/documentos/confirmacao-upload", zValidator("json", uploadConfirmacaoSchema), async (c) => {
    try { return c.json(await documentos.confirmarUpload(c.req.valid("json").uploadToken, await resolverEscopoEscrita(c), exigirUsuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .delete("/financeiro/operacoes/rascunho/documentos/:id", async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
      await documentos.removerDocumentoRascunho(c.req.param("id"), rascunho.id, propriedadeId, uid);
      return c.body(null, 204);
    } catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/operacoes/rascunho/documentos/:id", zValidator("json", z.object({ tipo: tipoDocumentoFinanceiroSchema.optional(), numero: z.string().max(80).nullable().optional() })), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c); const uid = exigirUsuarioId(c);
      const rascunho = await rascunhos.obterRascunho(propriedadeId, uid);
      if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
      return c.json(await documentos.atualizarDocumentoRascunho(c.req.param("id"), rascunho.id, propriedadeId, uid, c.req.valid("json")));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes/:id", async (c) => {
    try { return c.json(await operacoes.obterOperacao(c.req.param("id"), await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes/:id/vinculos-pecuaria", async (c) => {
    const usuario = getUsuario(c);
    if (usuario && !temArea(usuario, "pecuaria")) return c.json({ error: "Sem acesso à Pecuária" }, 403);
    try {
      const dados = await listarOrigemFinanceira(c.req.param("id"), await resolverEscopoLeitura(c));
      return c.json(usuario && !temPermissao(usuario, "verValores") ? { ...dados, fatos: dados.fatos.map((f) => ({ ...f, custoProduto: null, rateioServico: null })) } : dados);
    }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes", zValidator("json", operacaoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await operacoes.criarOperacao({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/estorno", exigePermissao("lancar"), zValidator("json", estornoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await operacoes.estornarOperacao(c.req.param("id"), c.req.valid("json").motivo, { propriedadeId, usuarioId: usuarioId(c) }), 201);
    }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/documentos/intencao", zValidator("json", uploadIntentSchema), async (c) => {
    try { return c.json(await documentos.solicitarUploadOperacao(c.req.param("id"), await resolverEscopoEscrita(c), usuarioId(c), c.req.valid("json")), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/financeiro/operacoes/:id/documentos/confirmacao-upload", zValidator("json", uploadConfirmacaoSchema), async (c) => {
    try { return c.json(await documentos.confirmarUpload(c.req.valid("json").uploadToken, await resolverEscopoEscrita(c), usuarioId(c)), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/documentos/:id/download", async (c) => {
    try {
      const documento = await documentos.obterDocumento(c.req.param("id"), await resolverEscopoEscrita(c));
      const storage = await getStorage();
      return c.redirect(await storage.getSignedDownloadUrl({ key: documento.storageKey!, filename: documento.nome }));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/compromissos", validarPeriodo, async (c) => {
    const periodo = c.req.valid("query");
    return c.json(await operacoes.listarCompromissos(await resolverEscopoLeitura(c), periodo.inicio && periodo.fim ? { inicio: new Date(`${periodo.inicio}T00:00:00Z`), fim: new Date(`${periodo.fim}T23:59:59.999Z`) } : undefined));
  })
  .post("/financeiro/compromissos/:id/liquidacoes", zValidator("json", liquidacaoSchema), async (c) => {
    try { return c.json(await operacoes.liquidarCompromisso(c.req.param("id"), { ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
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
  .post("/financeiro/transacoes/:id/estorno", exigePermissao("lancar"), zValidator("json", estornoSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await operacoes.estornarTransacao(c.req.param("id"), c.req.valid("json").motivo, { propriedadeId, usuarioId: usuarioId(c) }), 201);
    }
    catch (e) { return falha(c, e); }
  });
