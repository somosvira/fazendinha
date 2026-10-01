import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { EstoqueError } from "../../services/estoque/estoque.js";
import * as dietas from "../../services/pecuaria/nutricao/dietas.js";
import * as consumo from "../../services/pecuaria/nutricao/consumo.js";

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const validar = <T extends z.ZodTypeAny>(s: T) => zValidator("json", s, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
function falha(c: Context, e: unknown) {
  if (e instanceof RebanhoError || e instanceof EstoqueError) return c.json({ error: e.message, code: e.code }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(e.code)) return c.json({ error: "Conflito de atualização; recarregue e tente novamente", code: "CONFLITO" }, 409);
  console.error("[pecuaria/nutricao]", e);
  return c.json({ error: "Erro inesperado ao processar nutrição" }, 500);
}
const contexto = z.object({ loteId: uuid, propriedadeId: z.number().int().positive(), inicio: data, fim: data, centroCustoId: uuid.nullish() });
const itemConsumo = z.object({ produtoId: uuid, quantidadeConfirmada: z.number().nonnegative().optional(), motivoAjuste: z.string().trim().max(500).nullish(), modoEstoque: z.enum(["BAIXA_ESTOQUE", "SEM_BAIXA_JUSTIFICADA"]), justificativaSemBaixa: z.string().trim().max(500).nullish(), partidas: z.array(z.object({ partidaId: uuid, quantidade: z.number().positive() })).optional() }).strict();

export const nutricaoRouter = new Hono()
  .post("/vigencias/:id/correcao", validar(z.object({ propriedadeId: z.number().int().positive(), desde: data, motivo: z.string().trim().min(5).max(500) }).strict()), async (c) => {
    try { const { propriedadeId: solicitado, ...input } = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, solicitado);
      return c.json(await dietas.corrigirVigencia(c.req.param("id"), propriedadeId, input, getUsuario(c)?.id ?? null)); } catch (e) { return falha(c, e); }
  })
  .post("/consumo/periodos/previa", validar(contexto), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId); const previa = await consumo.previaPeriodos({ ...body, propriedadeId });
      const u = getUsuario(c); const valores = !!u && temArea(u, "financeiro") && temPermissao(u, "verValores");
      return c.json({ ...previa, periodos: previa.periodos.map((p) => ({ ...p, itens: p.itens.map((i) => ({ ...i, custoPrevisto: valores ? i.custoPrevisto : null })) })) }); } catch (e) { return falha(c, e); }
  })
  .post("/consumo/periodos/confirmacao", validar(contexto.extend({ chave: uuid, periodos: z.array(z.object({ inicio: data, fim: data, itens: z.array(itemConsumo).min(1) }).strict()).min(1).max(100) }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId); return c.json(await consumo.confirmarPeriodos({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); } catch (e) { return falha(c, e); }
  })
  .patch("/dietas/:id", validar(z.object({ nome: z.string().trim().min(2).max(160), observacao: z.string().trim().max(500).nullish(), itens: z.array(z.object({ produtoId: uuid, quantidadeCabecaDia: z.number().positive() })).min(1) })), async (c) => {
    try { return c.json(await dietas.criarDieta(c.req.valid("json"), getUsuario(c)?.id ?? null, c.req.param("id"))); } catch (e) { return falha(c, e); }
  })
  .get("/dietas", async (c) => { try { return c.json(await dietas.listarDietas()); } catch (e) { return falha(c, e); } })
  .post("/dietas", validar(z.object({ nome: z.string().trim().min(2).max(160), observacao: z.string().trim().max(500).nullish(),
    itens: z.array(z.object({ produtoId: uuid, quantidadeCabecaDia: z.number().positive() })).min(1) })), async (c) => {
    try { return c.json(await dietas.criarDieta(c.req.valid("json"), getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/dietas/:id/publicacao", async (c) => {
    try { return c.json(await dietas.publicarDieta(c.req.param("id"), getUsuario(c)?.id ?? null)); }
    catch (e) { return falha(c, e); }
  })
  .get("/vigencias", async (c) => {
    try { const loteId = c.req.query("loteId"); if (loteId && !uuid.safeParse(loteId).success) return c.json({ error: "Lote inválido", code: "VALIDACAO" }, 422);
      return c.json(await dietas.listarVigencias(loteId, await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/vigencias", validar(z.object({ loteId: uuid, propriedadeId: z.number().int().positive(), dietaId: uuid, desde: data })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await dietas.atribuirDieta({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/consumo/previa", validar(contexto), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      const previa = await consumo.previaConsumo({ ...body, propriedadeId }); const u = getUsuario(c); const valores = !!u && temArea(u, "financeiro") && temPermissao(u, "verValores");
      return c.json({ ...previa, itens: previa.itens.map((i) => ({ ...i, custoPrevisto: valores ? i.custoPrevisto : null })) }); }
    catch (e) { return falha(c, e); }
  })
  .post("/consumo/confirmacao", validar(contexto.extend({ itens: z.array(z.object({ produtoId: uuid,
    quantidadeConfirmada: z.number().nonnegative().optional(), motivoAjuste: z.string().trim().max(500).nullish(),
    modoEstoque: z.enum(["BAIXA_ESTOQUE", "SEM_BAIXA_JUSTIFICADA"]), justificativaSemBaixa: z.string().trim().max(500).nullish(),
    partidas: z.array(z.object({ partidaId: uuid.optional(), codigo: z.string().trim().min(1).max(100).optional(),
      validade: data.nullish(), quantidade: z.number().positive() })).optional() })).min(1) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await consumo.confirmarConsumo({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/consumo/fechamentos", async (c) => {
    try { const loteId = c.req.query("loteId"); if (loteId && !uuid.safeParse(loteId).success) return c.json({ error: "Lote inválido", code: "VALIDACAO" }, 422);
      const lista = await consumo.listarFechamentos(loteId, await resolverEscopoLeitura(c)); const u = getUsuario(c); const valores = !!u && temArea(u, "financeiro") && temPermissao(u, "verValores");
      return c.json(lista.map((f) => ({ ...f, itens: f.itens.map((i) => ({ ...i, movimentoEstoque: i.movimentoEstoque ? { ...i.movimentoEstoque, valorTotal: valores ? i.movimentoEstoque.valorTotal : null, custoUnitario: valores ? i.movimentoEstoque.custoUnitario : null } : null })) }))); }
    catch (e) { return falha(c, e); }
  })
  .post("/consumo/fechamentos/:id/estorno", validar(z.object({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await consumo.estornarFechamento(c.req.param("id"), propriedadeId, body.motivo, getUsuario(c)?.id ?? null)); }
    catch (e) { return falha(c, e); }
  });
