import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { OrigemMovimentoEstoque } from "@prisma/client";
import { prisma } from "../db.js";
import * as svc from "../services/estoque/estoque.js";
import * as produtosSvc from "../services/estoque/produtos.js";
import * as partidasSvc from "../services/estoque/partidas.js";
import * as fichaSvc from "../services/estoque/ficha-produto.js";
import { transferirEstoque } from "../services/estoque/transferencias.js";
import { produtoSchema, patchProdutoSchema, produtosQuerySchema } from "../services/estoque/produtos.schemas.js";
import * as refSvc from "../services/estoque/referencias.js";
import { listarParceiros } from "../services/financeiro/parceiros.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import { exigePermissao, getUsuario } from "../middleware/permissao.js";
import { temArea, temPermissao } from "../services/auth/papeis.js";
import { SEM_VINCULO } from "../lib/ids.js";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string; code?: string } } {
  if (e instanceof svc.EstoqueError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409, ORIGEM_AUTOMATICA: 409, CONFLITO: 409, VALIDACAO: 400 } as const;
    // `code` deixa o cliente distinguir CONFLITO (saldo mudou) de MES_FECHADO, ambos 409.
    return { status: map[e.code], body: { error: e.message, code: e.code } };
  }
  console.error("[estoque]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Mapeamento de erro dos cadastros de referência (produto) para status HTTP —
// essas rotas ficam sob o gate mais amplo de /api/estoque/*: pecuária, agricultura
// ou financeiro.
function failCadastro(e: unknown): { status: 400 | 404 | 409 | 500; body: { error: string; campo?: string } } {
  if (e instanceof FinanceiroError) {
    const map = { VALIDACAO: 400, NAO_ENCONTRADO: 404, CONFLITO: 409, PERIODO_FECHADO: 409, SALDO_INSUFICIENTE: 409, JA_REVERTIDO: 409 } as const;
    return { status: map[e.code], body: { error: e.message, ...(e.campo ? { campo: e.campo } : {}) } };
  }
  console.error("[estoque/cadastros]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// SEM_VINCULO = "sem centro de custo"; ausente = sem filtro.
const saldosQuerySchema = z.object({ centroCustoId: z.string().uuid().or(z.literal(SEM_VINCULO)).optional() });
const movimentosQuerySchema = z.object({
  movimentoId: z.string().uuid().optional(),
  produtoId: z.string().uuid().optional(),
  partidaId: z.string().uuid().optional(),
  propriedadeId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]).optional(),
  q: z.string().trim().max(80).optional(),
  origem: z.nativeEnum(OrigemMovimentoEstoque).optional(),
  centroCustoId: z.string().uuid().or(z.literal(SEM_VINCULO)).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(15),
});
const ultimoPrecoQuerySchema = z.object({ parceiroId: z.string().uuid().optional() });
const nomeLoteSchema = z.string({ required_error: "Informe o nome do lote", invalid_type_error: "Informe um nome válido para o lote" }).trim().min(1, "Informe o nome do lote").max(160, "O nome do lote aceita até 160 caracteres");
const validadeLoteSchema = z.string({ required_error: "Informe a validade ou escolha Validade não informada", invalid_type_error: "Informe uma validade válida" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma validade válida");
const paginaProdutoSchema = z.object({ partidaId: z.string().uuid("Selecione um lote válido").optional(), pagina: z.coerce.number({ invalid_type_error: "Informe uma página válida" }).int("Informe uma página inteira").min(1, "A página começa em 1").default(1), porPagina: z.coerce.number({ invalid_type_error: "Informe a quantidade por página" }).int().min(1, "Informe ao menos um item por página").max(100, "Consulte até 100 itens por página").default(15) });

const usuarioId = (c: Parameters<typeof getUsuario>[0]) => getUsuario(c)?.id ?? null;
const podeVerCustos = (c: Parameters<typeof getUsuario>[0]) => { const u = getUsuario(c); return !!u && temArea(u, "financeiro") && temPermissao(u, "verValores"); };
function apresentarMovimentos(c: Parameters<typeof getUsuario>[0], resultado: Awaited<ReturnType<typeof svc.listarMovimentos>>) {
  const u = getUsuario(c);
  const financeiro = u ? temArea(u, "financeiro") : true;
  const custos = podeVerCustos(c);
  return { ...resultado, itens: resultado.itens.map((m) => ({ ...m,
    ...(financeiro ? {} : { operacaoId: null, operacaoNumero: null }),
    ...(custos ? {} : { custoUnitario: null, valorTotal: null, ...(m.valorTotalMovimento === undefined ? {} : { valorTotalMovimento: null }) }),
  })) };
}
const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);
function validarProduto<T extends z.ZodTypeAny>(schema: T) {
  return zValidator("json", schema, (resultado, c) => {
    if (!resultado.success) { const erro = resultado.error.issues[0]; return c.json({ error: erro.message, code: "VALIDACAO", campo: erro.path.join(".") }, 422); }
  });
}

// Leituras ficam só com o gate de área (app.ts); escritas exigem a flag `lancar`.
export const estoqueRouter = new Hono()
  .post("/estoque/perdas", exigePermissao("lancar"), zValidator("json", z.object({ chave: z.string().uuid(), produtoId: z.string().uuid(), origemId: z.number().int().positive(), quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), motivo: z.string().trim().min(5).max(200), partidas: z.array(z.object({ partidaId: z.string().uuid(), quantidade: z.number().positive() })).optional() }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const origemId = await resolverEscopoEscrita(c, body.origemId); return c.json(await transferirEstoque({ ...body, origemId, destinoId: origemId, modo: "PERDA" }, usuarioId(c)), 201); } catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .post("/estoque/transferencias", exigePermissao("lancar"), zValidator("json", z.object({ chave: z.string().uuid(), produtoId: z.string().uuid(), origemId: z.number().int().positive(), destinoId: z.number().int().positive(), quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), motivo: z.string().trim().min(5).max(200), partidas: z.array(z.object({ partidaId: z.string().uuid(), quantidade: z.number().positive() })).optional() }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const origemId = await resolverEscopoEscrita(c, body.origemId); const destinoId = await resolverEscopoEscrita(c, body.destinoId); return c.json(await transferirEstoque({ ...body, origemId, destinoId }, usuarioId(c)), 201); } catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/saldos", zValidator("query", saldosQuerySchema), async (c) => {
    const { centroCustoId } = c.req.valid("query");
    const u = getUsuario(c);
    const saldos = await svc.listarSaldos({ centroCustoId, propriedadeId: await resolverEscopoLeitura(c), materialGeneticoVisivel: u ? temArea(u, "pecuaria") : true });
    return c.json(podeVerCustos(c) ? saldos : saldos.map((s) => ({ ...s, custoMedio: null, valor: null })));
  })
  .get("/estoque/movimentos", zValidator("query", movimentosQuerySchema), async (c) => {
    const { movimentoId, produtoId, partidaId, propriedadeId, tipo, q, origem, centroCustoId, de, ate, pagina, porPagina } = c.req.valid("query");
    // O gate de /estoque aceita pecuária, agricultura ou financeiro; o vínculo
    // (talhão) das saídas automáticas só vai para quem tem a área.
    const u = getUsuario(c);
    const vinculosVisiveis = u ? { pecuaria: temArea(u, "pecuaria") } : undefined;
    const movimentos = await svc.listarMovimentos({ movimentoId, produtoId, partidaId, tipo, q, origem, centroCustoId, de, ate, pagina, porPagina, propriedadeId: propriedadeId ?? await resolverEscopoLeitura(c), vinculosVisiveis });
    return c.json(apresentarMovimentos(c, movimentos));
  })
  .post("/estoque/ajustes", exigePermissao("lancar"), zValidator("json", svc.ajusteContagemSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      if (propriedadeId == null) throw new svc.EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
      return c.json(await svc.ajustarContagem({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/estoque/movimentos", exigePermissao("lancar"), zValidator("json", svc.movimentoSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId ?? null);
      return c.json(await svc.registrarMovimento({ ...input, propriedadeId, usuarioId: usuarioId(c) }), 201);
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  // Sem DELETE de movimento: movimento de estoque confirmado só é desfeito pelo
  // domínio que o originou (estorno da operação ou da aplicação agrícola).

  // ── Produtos (cadastro) ─────────────────────────────────────────────────────
  .get("/estoque/partidas", zValidator("query", z.object({ produtoId: z.string().uuid(), propriedadeId: z.coerce.number().int().positive().optional() })), async (c) => {
    try {
      const propriedadeId = c.req.valid("query").propriedadeId ?? await resolverEscopoLeitura(c);
      return c.json(await partidasSvc.listarPartidas(c.req.valid("query").produtoId, propriedadeId));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/estoque/produtos/:id/rastreio/previa", async (c) => {
    try {
      if (!z.string().uuid().safeParse(c.req.param("id")).success) throw new svc.EstoqueError("VALIDACAO", "Produto inválido");
      return c.json(await partidasSvc.previaAtivacaoRastreio(c.req.param("id")));
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/estoque/produtos/:id/rastreio", exigePermissao("lancar"), zValidator("json", z.object({ revisao: z.string().regex(/^[a-f0-9]{64}$/) })), async (c) => {
    try {
      if (!z.string().uuid().safeParse(c.req.param("id")).success) throw new svc.EstoqueError("VALIDACAO", "Produto inválido");
      return c.json(await partidasSvc.ativarRastreio(c.req.param("id"), usuarioId(c), c.req.valid("json").revisao), 201);
    } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .post("/estoque/produtos/:id/identificar-legado", exigePermissao("lancar"), validarProduto(z.object({ chave: z.string().uuid("Atualize a confirmação e tente novamente"), codigo: z.string().trim().min(1, "Informe a referência histórica").max(100, "A referência aceita até 100 caracteres").optional(), nome: nomeLoteSchema.optional(), validade: validadeLoteSchema.nullable(), quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/, "Informe uma quantidade com até três casas decimais"), motivo: z.string().trim().min(5, "Explique a identificação em pelo menos cinco caracteres").max(500, "A justificativa aceita até 500 caracteres"), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida") })), async (c) => {
    try { if (!z.string().uuid().safeParse(c.req.param("id")).success) throw new svc.EstoqueError("VALIDACAO", "Produto inválido");
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await partidasSvc.identificarLegado({ ...c.req.valid("json"), produtoId: c.req.param("id"), propriedadeId }, usuarioId(c)), 201);
    } catch (e) { const { status, body } = e instanceof FinanceiroError ? failCadastro(e) : fail(e); return c.json(body, status); }
  })
  .get("/estoque/produtos", zValidator("query", produtosQuerySchema), async (c) => {
    const { uso, q, ativo } = c.req.valid("query");
    return c.json(await produtosSvc.listarProdutos({ uso, q, ativo: parseAtivo(ativo), incluirInativos: true }));
  })
  .patch("/estoque/partidas/:id", exigePermissao("lancar"), validarProduto(z.object({ nome: nomeLoteSchema }).strict()), async (c) => {
    try { return c.json(await partidasSvc.renomearLote(c.req.param("id"), c.req.valid("json").nome, usuarioId(c))); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id", async (c) => {
    try { const u = getUsuario(c); return c.json(await fichaSvc.detalheProduto(c.req.param("id"), await resolverEscopoLeitura(c), podeVerCustos(c), u ? temArea(u, "financeiro") : true)); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id/lotes", zValidator("query", paginaProdutoSchema), async (c) => {
    try { const { pagina, porPagina } = c.req.valid("query"); return c.json(await fichaSvc.lotesProduto(c.req.param("id"), await resolverEscopoLeitura(c), pagina, porPagina)); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id/lotes/previa", zValidator("query", z.object({ validade: validadeLoteSchema.or(z.literal("nao-informada")) }), (r, c) => !r.success ? c.json({ error: "Informe uma validade válida ou escolha Validade não informada", code: "VALIDACAO", campo: "validade" }, 422) : undefined), async (c) => {
    try { const { validade } = c.req.valid("query"); return c.json(await partidasSvc.previaGrupoEntrada(c.req.param("id"), validade === "nao-informada" ? null : validade)); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id/origens", zValidator("query", paginaProdutoSchema), async (c) => {
    try { const u = getUsuario(c); return c.json(await fichaSvc.origensProduto(c.req.param("id"), await resolverEscopoLeitura(c), c.req.valid("query"), podeVerCustos(c), u ? temArea(u, "financeiro") : true)); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id/movimentos", zValidator("query", movimentosQuerySchema), async (c) => {
    try { const u = getUsuario(c); const resultado = await svc.listarMovimentos({ ...c.req.valid("query"), produtoId: c.req.param("id"), propriedadeId: await resolverEscopoLeitura(c), vinculosVisiveis: u ? { pecuaria: temArea(u, "pecuaria") } : undefined });
      return c.json(apresentarMovimentos(c, resultado)); }
    catch (e) { const f = fail(e); return c.json(f.body, f.status); }
  })
  .get("/estoque/produtos/:id/ultimo-preco", zValidator("query", ultimoPrecoQuerySchema), async (c) => {
    if (!podeVerCustos(c)) return c.json(null);
    const { parceiroId } = c.req.valid("query");
    return c.json(await produtosSvc.obterUltimoPreco(c.req.param("id"), { parceiroId, propriedadeId: await resolverEscopoLeitura(c) }));
  })
  // Sem compra anterior, a sugestão de preço na compra recorre ao custo médio
  // atual do produto (mesma conta de `services/estoque/estoque.ts`) — só de apoio,
  // não preenche o campo automaticamente (ver FormOperacao.tsx).
  .get("/estoque/produtos/:id/custo-medio", async (c) => {
    if (!podeVerCustos(c)) return c.json({ custoMedio: null });
    const custoMedio = await svc.obterCustoMedio(prisma, c.req.param("id"), await resolverEscopoLeitura(c));
    return c.json({ custoMedio: custoMedio ? custoMedio.toNumber() : null });
  })
  .post("/estoque/produtos", exigePermissao("lancar"), validarProduto(produtoSchema), async (c) => {
    try { return c.json(await produtosSvc.criarProduto(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .patch("/estoque/produtos/:id", exigePermissao("lancar"), validarProduto(patchProdutoSchema), async (c) => {
    try { return c.json(await produtosSvc.atualizarProduto(c.req.param("id"), c.req.valid("json"), usuarioId(c))); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })

  // ── Referência (categorias / centros de custo do plano financeiro / fornecedores) ─
  .get("/estoque/categorias", async (c) => c.json(await refSvc.listarCategorias(c.req.query("incluirInativos") === "1")))
  .get("/estoque/centros-custo", async (c) => c.json(await refSvc.listarCentrosCusto(c.req.query("incluirInativos") === "1")))
  .get("/estoque/fornecedores", async (c) => {
    // listarParceiros já devolve `papeis` resolvidos (PapelParceiro[]).
    const parceiros = await listarParceiros(true);
    return c.json(parceiros.filter((p) => p.papeis.includes("FORNECEDOR")));
  });
