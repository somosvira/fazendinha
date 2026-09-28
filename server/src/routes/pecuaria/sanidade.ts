import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma, UnidadeMedida } from "@prisma/client";
import { prisma } from "../../db.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import * as aplicacoes from "../../services/pecuaria/sanidade/aplicacoes.js";
import * as ocorrencias from "../../services/pecuaria/sanidade/ocorrencias.js";

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const aplicacaoSchema = z.object({
  animalId: uuid, propriedadeId: z.number().int().positive(), data,
  aplicadaEm: z.string().datetime({ offset: true }),
  finalidade: z.enum(["TRATAMENTO", "VACINA", "VERMIFUGO"]),
  origemInsumo: z.enum(["BAIXA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "INCLUSO_SERVICO", "SEM_ORIGEM_JUSTIFICADA"]),
  nomeProdutoAplicado: z.string().trim().min(1).max(180),
  produtoId: uuid.nullish(), dose: z.string().regex(/^\d+(\.\d{1,3})?$/),
  unidadeDose: z.nativeEnum(UnidadeMedida),
  carenciaLeiteHoras: z.number().int().min(0).nullish(),
  carenciaCarneHoras: z.number().int().min(0).nullish(),
  referenciaCarencia: z.string().trim().max(300).nullish(),
  ocorrenciaId: uuid.nullish(), tarefaId: uuid.nullish(),
  operacaoServicoId: uuid.nullish(), itemCompraDiretaId: uuid.nullish(),
  partidaId: uuid.nullish(), partidaCodigo: z.string().trim().max(100).nullish(),
  justificativaSemOrigem: z.string().trim().max(500).nullish(),
}).strict();

function falha(c: Context, e: unknown) {
  if (e instanceof RebanhoError || e instanceof FinanceiroError) {
    const status = e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: e.message, code: e.code, ...(e.campo ? { campo: e.campo } : {}) }, status);
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(e.code)) {
    return c.json({ error: "Os dados mudaram durante a confirmação. Recarregue e tente novamente.", code: "CONFLITO" }, 409);
  }
  console.error("[pecuaria/sanidade]", e);
  return c.json({ error: "Erro inesperado ao processar sanidade" }, 500);
}

const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => {
  if (!r.success) return c.json({ error: r.error.issues[0].message, code: "VALIDACAO", campo: String(r.error.issues[0].path[0] ?? "") }, 422);
});
const podeVerCustos = (c: Context) => { const u = getUsuario(c); return !!u && temArea(u, "financeiro") && temPermissao(u, "verValores"); };
const ocultarCustos = <T extends { valorProdutoAtribuido: unknown; valorServicoAtribuido: unknown }>(item: T, c: Context): T =>
  podeVerCustos(c) ? item : { ...item, valorProdutoAtribuido: null, valorServicoAtribuido: null };

export const sanidadeRouter = new Hono()
  .get("/doencas", async (c) => { try { return c.json(await ocorrencias.listarDoencas()); } catch (e) { return falha(c, e); } })
  .post("/doencas", validar(z.object({ nome: z.string().trim().min(2).max(120), motivoBaixaSugeridoId: uuid.nullish() })), async (c) => {
    try { const body = c.req.valid("json"); return c.json(await ocorrencias.criarDoenca(body.nome, body.motivoBaixaSugeridoId ?? null, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/ocorrencias", async (c) => {
    try {
      const animalId = c.req.query("animalId");
      if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json(await ocorrencias.listarOcorrencias(animalId, await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/ocorrencias", validar(z.object({ animalId: uuid, propriedadeId: z.number().int().positive(), doencaId: uuid,
    inicio: data, observacao: z.string().trim().max(500).nullish() })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await ocorrencias.criarOcorrencia({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/ocorrencias/:id/encerramento", validar(z.object({ propriedadeId: z.number().int().positive(), fim: data,
    desfecho: z.string().trim().min(2).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await ocorrencias.encerrarOcorrencia(c.req.param("id"), propriedadeId, body, getUsuario(c)?.id ?? null)); }
    catch (e) { return falha(c, e); }
  })
  .post("/ocorrencias/:id/anulacao", validar(z.object({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await ocorrencias.anularOcorrencia(c.req.param("id"), propriedadeId, body.motivo, getUsuario(c)?.id ?? null)); }
    catch (e) { return falha(c, e); }
  })
  .get("/aplicacoes", async (c) => {
    try {
      const animalId = c.req.query("animalId");
      if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json((await aplicacoes.listarAplicacoes(animalId, await resolverEscopoLeitura(c))).map((a) => ocultarCustos(a, c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes", validar(aplicacaoSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(ocultarCustos(await aplicacoes.criarAplicacao({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), c), 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id/carencia", async (c) => {
    try {
      if (!uuid.safeParse(c.req.param("id")).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json(await aplicacoes.carenciaAnimal(c.req.param("id"), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes/:id/anulacao", validar(z.object({ motivo: z.string().trim().min(5).max(500), propriedadeId: z.number().int().positive() })), async (c) => {
    try {
      if (!uuid.safeParse(c.req.param("id")).success) return c.json({ error: "Aplicação inválida", code: "VALIDACAO" }, 422);
      const body = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(ocultarCustos(await aplicacoes.anularAplicacao(c.req.param("id"), propriedadeId, body.motivo, getUsuario(c)?.id ?? null), c));
    } catch (e) { return falha(c, e); }
  })
  .get("/servicos", async (c) => {
    try {
      const solicitado = c.req.query("propriedadeId");
      if (solicitado && !/^\d+$/.test(solicitado)) return c.json({ error: "Sítio inválido", code: "VALIDACAO" }, 422);
      const propriedadeId = solicitado ? await resolverEscopoEscrita(c, Number(solicitado)) : await resolverEscopoLeitura(c);
      const servicos = await prisma.operacao.findMany({ where: { tipo: "SERVICO", status: "CONFIRMADA", ...(propriedadeId == null ? {} : { propriedadeId }) },
        select: { id: true, numero: true, data: true, descricao: true, valorTotal: true, parceiro: { select: { nome: true } } },
        orderBy: { data: "desc" }, take: 100 });
      return c.json(podeVerCustos(c) ? servicos : servicos.map(({ valorTotal: _valorTotal, ...servico }) => servico));
    } catch (e) { return falha(c, e); }
  });
