import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { TipoProduto } from "@prisma/client";
import * as svc from "../services/estoque/estoque.js";
import * as produtosSvc from "../services/estoque/produtos.js";
import { produtoSchema, patchProdutoSchema } from "../services/estoque/produtos.schemas.js";
import * as refSvc from "../services/rebanho/financeiro-ref.js";
import * as principioSvc from "../services/rebanho/principio-ativo.js";
import { criarPrincipioSchema, atualizarPrincipioSchema, definirComposicaoSchema } from "../services/rebanho/principio-ativo.schemas.js";
import * as composicaoRacaoSvc from "../services/rebanho/composicao-produto.js";
import { composicaoRacaoBodySchema } from "../services/rebanho/composicao-produto.schemas.js";
import * as lotesSvc from "../services/rebanho/lotes.js";
import { criarLocalSchema, criarLoteSchema } from "../services/rebanho/lotes.schemas.js";
import { listarParceiros } from "../services/financeiro/parceiros.js";
import { papeisDoParceiro } from "../services/financeiro/papeis.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import { exigePermissao, getUsuario } from "../middleware/permissao.js";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.EstoqueError) {
    const map = { NAO_ENCONTRADO: 404, MES_FECHADO: 409, ORIGEM_AUTOMATICA: 409, CONFLITO: 409, VALIDACAO: 400 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[estoque]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// Cadastros de referência (produto, princípio ativo, composição, lote de produto)
// usam os mesmos services das rotas /rebanho/*, sem duplicar lógica de negócio —
// só o mapeamento de erro para status HTTP muda (essas rotas ficam sob o gate
// mais amplo de /api/estoque/*: pecuária, agricultura ou financeiro).
function failCadastro(e: unknown): { status: 400 | 404 | 409 | 500; body: { error: string; campo?: string } } {
  if (e instanceof FinanceiroError) {
    const map = { VALIDACAO: 400, NAO_ENCONTRADO: 404, CONFLITO: 409, PERIODO_FECHADO: 409, SALDO_INSUFICIENTE: 409, JA_REVERTIDO: 409 } as const;
    return { status: map[e.code], body: { error: e.message, ...(e.campo ? { campo: e.campo } : {}) } };
  }
  if (e instanceof principioSvc.PrincipioError) {
    return { status: e.code === "NOME_DUPLICADO" ? 409 : 404, body: { error: e.message } };
  }
  if (e instanceof composicaoRacaoSvc.ComposicaoProdutoError) return { status: 404, body: { error: e.message } };
  if (e instanceof lotesSvc.LoteError) return { status: 404, body: { error: e.message } };
  console.error("[estoque/cadastros]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// `0` = "sem centro de custo"; ausente = sem filtro.
const saldosQuerySchema = z.object({ centroCustoId: z.coerce.number().int().nonnegative().optional() });
const movimentosQuerySchema = z.object({
  produtoId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]).optional(),
});
const custoVacaDiaQuerySchema = z.object({ dias: z.coerce.number().int().min(1).max(365).optional() });
const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const usuarioId = (c: Parameters<typeof getUsuario>[0]) => getUsuario(c)?.id ?? null;
const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);

const produtosQuerySchema = z.object({ tipo: z.nativeEnum(TipoProduto).optional(), q: z.string().optional(), ativo: z.enum(["true", "false"]).optional() });
const principiosQuerySchema = z.object({ inativos: z.string().optional() });

// Leituras ficam só com o gate de área (app.ts); escritas exigem a flag `lancar`.
export const estoqueRouter = new Hono()
  .get("/estoque/saldos", zValidator("query", saldosQuerySchema), async (c) => {
    const { centroCustoId } = c.req.valid("query");
    return c.json(await svc.listarSaldos({ centroCustoId, propriedadeId: await resolverEscopoLeitura(c) }));
  })
  .get("/estoque/movimentos", zValidator("query", movimentosQuerySchema), async (c) => {
    const { produtoId, tipo } = c.req.valid("query");
    return c.json(await svc.listarMovimentos({ produtoId, tipo, propriedadeId: await resolverEscopoLeitura(c) }));
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
  .delete("/estoque/movimentos/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const propriedadeId = await resolverEscopoEscrita(c);
      await svc.excluirMovimento(id, propriedadeId, usuarioId(c));
      return c.json({ ok: true });
    }
    catch (e) { const { status, body } = fail(e); return c.json(body, status); }
  })
  .get("/estoque/custo-vaca-dia", zValidator("query", custoVacaDiaQuerySchema), async (c) => {
    const { dias } = c.req.valid("query");
    return c.json(await svc.calcularCustoVacaDia(dias, await resolverEscopoLeitura(c)));
  })

  // ── Produtos (cadastro) ─────────────────────────────────────────────────────
  .get("/estoque/produtos", zValidator("query", produtosQuerySchema), async (c) => {
    const { tipo, q, ativo } = c.req.valid("query");
    return c.json(await produtosSvc.listarProdutos({ tipo, q, ativo: parseAtivo(ativo), incluirInativos: true }));
  })
  .post("/estoque/produtos", exigePermissao("lancar"), zValidator("json", produtoSchema), async (c) => {
    try { return c.json(await produtosSvc.criarProduto(c.req.valid("json"), usuarioId(c)), 201); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .patch("/estoque/produtos/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), zValidator("json", patchProdutoSchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await produtosSvc.atualizarProduto(id, c.req.valid("json"), usuarioId(c))); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })

  // ── Referência (categorias / centros de custo do plano financeiro / fornecedores) ─
  .get("/estoque/categorias", async (c) => c.json(await refSvc.listarCategorias(c.req.query("incluirInativos") === "1")))
  .get("/estoque/centros-custo", async (c) => c.json(await refSvc.listarCentrosCusto(c.req.query("incluirInativos") === "1")))
  .get("/estoque/fornecedores", async (c) => {
    const parceiros = await listarParceiros(true);
    return c.json(parceiros.filter((p) => papeisDoParceiro(p).includes("FORNECEDOR")));
  })

  // ── Princípios ativos (catálogo) + composição de medicamentos ───────────────
  .get("/estoque/principios-ativos", zValidator("query", principiosQuerySchema), async (c) => {
    const incluirInativos = c.req.valid("query").inativos === "1";
    return c.json(await principioSvc.listarPrincipios(incluirInativos));
  })
  .post("/estoque/principios-ativos", exigePermissao("lancar"), zValidator("json", criarPrincipioSchema), async (c) => {
    try { return c.json(await principioSvc.criarPrincipio(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .patch("/estoque/principios-ativos/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), zValidator("json", atualizarPrincipioSchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await principioSvc.atualizarPrincipio(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .delete("/estoque/principios-ativos/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), async (c) => {
    try { const { id } = c.req.valid("param"); await principioSvc.excluirPrincipio(id); return c.json({ ok: true }); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .get("/estoque/produtos/:id/composicao", zValidator("param", idParamSchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await principioSvc.obterComposicao(id)); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .put("/estoque/produtos/:id/composicao", exigePermissao("lancar"), zValidator("param", idParamSchema), zValidator("json", definirComposicaoSchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await principioSvc.definirComposicao(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })

  // ── Composição de ração (receita) ───────────────────────────────────────────
  .get("/estoque/produtos/:id/composicao-racao", zValidator("param", idParamSchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await composicaoRacaoSvc.obterComposicao(id)); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .put("/estoque/produtos/:id/composicao-racao", exigePermissao("lancar"), zValidator("param", idParamSchema), zValidator("json", composicaoRacaoBodySchema), async (c) => {
    try { const { id } = c.req.valid("param"); return c.json(await composicaoRacaoSvc.definirComposicao(id, c.req.valid("json"))); }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })

  // ── Locais de armazenamento + lotes de produto (código/validade) ───────────
  .get("/estoque/locais-armazenamento", async (c) => c.json(await lotesSvc.listarLocais(await resolverEscopoLeitura(c))))
  .post("/estoque/locais-armazenamento", exigePermissao("lancar"), zValidator("json", criarLocalSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await lotesSvc.criarLocal(c.req.valid("json"), propriedadeId), 201);
    }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .delete("/estoque/locais-armazenamento/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const propriedadeId = await resolverEscopoEscrita(c);
      await lotesSvc.excluirLocal(id, propriedadeId);
      return c.json({ ok: true });
    }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .get("/estoque/lotes-produto", async (c) => c.json(await lotesSvc.listarLotes(await resolverEscopoLeitura(c))))
  .post("/estoque/lotes-produto", exigePermissao("lancar"), zValidator("json", criarLoteSchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoEscrita(c);
      return c.json(await lotesSvc.criarLote(c.req.valid("json"), propriedadeId), 201);
    } catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  })
  .delete("/estoque/lotes-produto/:id", exigePermissao("lancar"), zValidator("param", idParamSchema), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const propriedadeId = await resolverEscopoEscrita(c);
      await lotesSvc.excluirLote(id, propriedadeId);
      return c.json({ ok: true });
    }
    catch (e) { const { status, body } = failCadastro(e); return c.json(body, status); }
  });
