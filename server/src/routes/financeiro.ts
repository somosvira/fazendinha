import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../services/propriedade.js";
import * as contas from "../services/financeiro/contas.js";
import * as parceiros from "../services/financeiro/parceiros.js";
import * as operacoes from "../services/financeiro/operacoes.js";
import { obterDashboard } from "../services/financeiro/dashboard.js";
import { contaSchema, estornoSchema, liquidacaoSchema, operacaoSchema, parceiroSchema, transacaoAvulsaSchema, transferenciaSchema } from "../services/financeiro/schemas.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { prisma } from "../db.js";

function usuarioId(c: Context): number | null {
  const usuario = c.get("usuario") as { id?: number } | undefined;
  return usuario?.id && usuario.id > 0 ? usuario.id : null;
}

function falha(c: Context, erro: unknown) {
  if (erro instanceof FinanceiroError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code }, status);
  }
  console.error("[financeiro]", erro);
  return c.json({ error: "Erro inesperado ao processar a solicitação" }, 500);
}

const patchContaSchema = contaSchema.pick({ nome: true, instituicao: true, identificacao: true, incluirNoSaldoGeral: true }).partial().extend({ ativo: z.boolean().optional() });
const patchParceiroSchema = parceiroSchema.partial().extend({ ativo: z.boolean().optional() });

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
    try { return c.json(await contas.atualizarConta(Number(c.req.param("id")), await resolverEscopoEscrita(c), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/contas/:id/extrato", async (c) => {
    try {
      const inicio = c.req.query("inicio") ? new Date(c.req.query("inicio")!) : undefined;
      const fim = c.req.query("fim") ? new Date(c.req.query("fim")!) : undefined;
      return c.json(await contas.listarExtrato(Number(c.req.param("id")), await resolverEscopoEscrita(c), inicio, fim));
    } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/parceiros", async (c) => c.json(await parceiros.listarParceiros(c.req.query("inativos") === "true")))
  .post("/financeiro/parceiros", zValidator("json", parceiroSchema), async (c) => {
    try { return c.json(await parceiros.criarParceiro({ ...c.req.valid("json"), usuarioId: usuarioId(c) }), 201); }
    catch (e) { return falha(c, e); }
  })
  .patch("/financeiro/parceiros/:id", zValidator("json", patchParceiroSchema), async (c) => {
    try { return c.json(await parceiros.atualizarParceiro(Number(c.req.param("id")), c.req.valid("json"), usuarioId(c))); }
    catch (e) { return falha(c, e); }
  })
  .get("/financeiro/operacoes", async (c) => c.json(await operacoes.listarOperacoes(await resolverEscopoLeitura(c))))
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
