import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db.js";
import * as svc from "../services/estoque/estoque.js";
import * as produtosSvc from "../services/estoque/produtos.js";
import { produtoSchema, patchProdutoSchema, produtosQuerySchema } from "../services/estoque/produtos.schemas.js";
import * as refSvc from "../services/rebanho/financeiro-ref.js";
import { listarParceiros } from "../services/financeiro/parceiros.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import { exigePermissao, getUsuario } from "../middleware/permissao.js";
import { temArea } from "../services/auth/papeis.js";

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

// `0` = "sem centro de custo"; ausente = sem filtro.
const saldosQuerySchema = z.object({ centroCustoId: z.coerce.number().int().nonnegative().optional() });
const movimentosQuerySchema = z.object({
  produtoId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]).optional(),
});
const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const ultimoPrecoQuerySchema = z.object({ parceiroId: z.coerce.number().int().positive().optional() });

const usuarioId = (c: Parameters<typeof getUsuario>[0]) => getUsuario(c)?.id ?? null;
const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);

// Leituras ficam só com o gate de área (app.ts); escritas exigem a flag `lancar`.
export const estoqueRouter = new Hono()
  .get("/estoque/saldos", zValidator("query", saldosQuerySchema), async (c) => {
    const { centroCustoId } = c.req.valid("query");
    return c.json(await svc.listarSaldos({ centroCustoId, propriedadeId: await resolverEscopoLeitura(c) }));
  })
  .get("/estoque/movimentos", zValidator("query", movimentosQuerySchema), async (c) => {
    const { produtoId, tipo } = c.req.valid("query");
    // O gate de /estoque aceita pecuária, agricultura ou financeiro; o vínculo
    // (animal/lote/talhão) das saídas automáticas só vai para quem tem a área.
    const u = getUsuario(c);
    const vinculosVisiveis = u ? { pecuaria: temArea(u, "pecuaria"), agricultura: temArea(u, "agricultura") } : undefined;
    return c.json(await svc.listarMovimentos({ produtoId, tipo, propriedadeId: await resolverEscopoLeitura(c), vinculosVisiveis }));
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
  // domínio que o originou (estorno da operação, do evento sanitário, da
  // aplicação agrícola ou do período de consumo).

  // ── Produtos (cadastro) ─────────────────────────────────────────────────────
  .get("/estoque/produtos", zValidator("query", produtosQuerySchema), async (c) => {
    const { uso, q, ativo } = c.req.valid("query");
    return c.json(await produtosSvc.listarProdutos({ uso, q, ativo: parseAtivo(ativo), incluirInativos: true }));
  })
  .get("/estoque/produtos/:id/ultimo-preco", zValidator("param", idParamSchema), zValidator("query", ultimoPrecoQuerySchema), async (c) => {
    const { id } = c.req.valid("param");
    const { parceiroId } = c.req.valid("query");
    return c.json(await produtosSvc.obterUltimoPreco(id, { parceiroId, propriedadeId: await resolverEscopoLeitura(c) }));
  })
  // Sem compra anterior, a sugestão de preço na compra recorre ao custo médio
  // atual do produto (mesma conta de `services/estoque/estoque.ts`) — só de apoio,
  // não preenche o campo automaticamente (ver FormOperacao.tsx).
  .get("/estoque/produtos/:id/custo-medio", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const custoMedio = await svc.obterCustoMedio(prisma, id, await resolverEscopoLeitura(c));
    return c.json({ custoMedio: custoMedio ? custoMedio.toNumber() : null });
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
    // listarParceiros já devolve `papeis` resolvidos (PapelParceiro[]).
    const parceiros = await listarParceiros(true);
    return c.json(parceiros.filter((p) => p.papeis.includes("FORNECEDOR")));
  });
