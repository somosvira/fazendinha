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
import * as protocolos from "../../services/pecuaria/sanidade/protocolos.js";
import * as exames from "../../services/pecuaria/sanidade/exames.js";
import * as tipos from "../../services/pecuaria/sanidade/tiposAplicacao.js";
import { consultaSanitariaSchema } from "../../services/pecuaria/sanidade/consulta.js";
import * as rateios from "../../services/pecuaria/sanidade/rateios.js";

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const aplicacaoSchema = z.object({
  animalId: uuid, propriedadeId: z.number().int().positive(), data,
  aplicadaEm: z.string().datetime({ offset: true }),
  finalidade: z.enum(["TRATAMENTO", "VACINA", "VERMIFUGO"]).optional(),
  tipoAplicacaoId: uuid.optional(), responsavel: z.string().trim().max(160).nullish(),
  estadoCarenciaLeite: z.enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"]).optional(),
  estadoCarenciaCarne: z.enum(["INFORMADO", "NAO_INFORMADO", "NAO_APLICAVEL"]).optional(),
  justificativaCarenciaLeite: z.string().trim().max(500).nullish(),
  justificativaCarenciaCarne: z.string().trim().max(500).nullish(),
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
  partidaValidade: data.nullish(),
  justificativaSemOrigem: z.string().trim().max(500).nullish(),
  documentacaoExcepcional: z.boolean().optional(),
  motivoDocumentacaoExcepcional: z.string().trim().min(5).max(500).nullish(),
}).strict();

function falha(c: Context, e: unknown) {
  if (e instanceof z.ZodError) return c.json({ error: e.issues[0].message, code: "VALIDACAO" }, 422);
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
  .post("/execucoes/coletivas", validar(z.object({ chave: uuid, propriedadeId: z.number().int().positive(), itens: z.array(z.object({ protocoloId: uuid, animalId: uuid, propriedadeId: z.number().int().positive(), inicio: data, ocorrenciaId: uuid.nullish(), operacaoServicoId: uuid.nullish() }).strict()).min(1).max(100) }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await protocolos.iniciarExecucaoColetivo({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); } catch (e) { return falha(c, e); }
  })
  .post("/exames/coletivos", validar(z.object({ chave: uuid, propriedadeId: z.number().int().positive(), itens: z.array(z.object({ animalId: uuid, propriedadeId: z.number().int().positive(), tipoExameId: uuid, data, resultadoTexto: z.string().trim().max(1000).nullish(), resultadoNumero: z.number().finite().nullish(), resultadoOpcao: z.string().trim().max(100).nullish(), ocorrenciaId: uuid.nullish(), tarefaId: uuid.nullish(), responsavel: z.string().trim().max(160).nullish(), operacaoServicoId: uuid.nullish() }).strict()).min(1).max(100) }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await exames.registrarExameColetivo({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); } catch (e) { return falha(c, e); }
  })
  .get("/rateios", zValidator("query", z.object({ servicoId: uuid, propriedadeId: z.coerce.number().int().positive() })), async (c) => {
    try { if (!podeVerCustos(c)) return c.json({ error: "Consultar rateios exige Financeiro e permissão para ver valores" }, 403);
      const body = c.req.valid("query"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId); return c.json(await rateios.listarRateios(body.servicoId, propriedadeId)); } catch (e) { return falha(c, e); }
  })
  .post("/rateios", validar(z.object({ servicoId: uuid, propriedadeId: z.number().int().positive(), tipo: z.enum(["APLICACAO", "EXAME", "PROTOCOLO"]), id: uuid, valor: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(), motivo: z.string().trim().min(5).max(500) }).strict()), async (c) => {
    try { if (!podeVerCustos(c)) return c.json({ error: "Ratear exige Financeiro e permissão para ver valores" }, 403);
      const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId); return c.json(await rateios.salvarRateio({ ...body, propriedadeId }, getUsuario(c)?.id ?? null)); } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes/coletivas", validar(z.object({ chave: uuid, propriedadeId: z.number().int().positive(), itens: z.array(aplicacaoSchema).min(1).max(100) }).strict()), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      if (body.itens.some((i) => i.propriedadeId !== propriedadeId)) return c.json({ error: "Todos os animais devem pertencer ao sítio da operação" }, 422);
      return c.json(await aplicacoes.criarAplicacoesColetivas({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes/:id/origem", validar(aplicacaoSchema.pick({ origemInsumo: true, produtoId: true, operacaoServicoId: true, itemCompraDiretaId: true, partidaId: true, partidaCodigo: true, partidaValidade: true }).extend({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) }).strict()), async (c) => {
    try { const { propriedadeId: solicitado, ...input } = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, solicitado);
      return c.json(ocultarCustos(await aplicacoes.reconciliarOrigem(c.req.param("id"), propriedadeId, input, getUsuario(c)?.id ?? null), c)); } catch (e) { return falha(c, e); }
  })
  .post("/exames/:id/correcao", validar(z.object({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500), anular: z.boolean().optional(), resultadoTexto: z.string().trim().max(1000).nullish(), resultadoNumero: z.number().finite().nullish(), resultadoOpcao: z.string().trim().max(100).nullish() }).strict()), async (c) => {
    try { const { propriedadeId: solicitado, ...input } = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, solicitado); const salvo = await exames.corrigirExame(c.req.param("id"), propriedadeId, input, getUsuario(c)?.id ?? null); return c.json({ ...salvo, valorServicoAtribuido: podeVerCustos(c) ? salvo.valorServicoAtribuido : null }); } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes/:id/carencia", validar(aplicacaoSchema.pick({ estadoCarenciaLeite: true, estadoCarenciaCarne: true, carenciaLeiteHoras: true, carenciaCarneHoras: true, justificativaCarenciaLeite: true, justificativaCarenciaCarne: true }).extend({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) }).strict()), async (c) => {
    try { const { propriedadeId: solicitado, ...input } = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, solicitado); return c.json(ocultarCustos(await aplicacoes.corrigirCarencia(c.req.param("id"), propriedadeId, input, getUsuario(c)?.id ?? null), c)); } catch (e) { return falha(c, e); }
  })
  .patch("/protocolos/:id", validar(z.object({ nome: z.string().trim().min(2).max(160), descricao: z.string().trim().max(500).nullish(), etapas: z.array(z.object({ diaRelativo: z.number().int().nonnegative(), tipo: z.enum(["APLICACAO", "EXAME"]), produtoId: uuid.nullish(), tipoExameId: uuid.nullish(), tipoAplicacaoId: uuid.nullish(), dose: z.number().positive().nullish(), unidade: z.string().trim().max(30).nullish(), via: z.string().trim().max(80).nullish() })).min(1) })), async (c) => {
    try { return c.json(await protocolos.criarProtocolo(c.req.valid("json"), getUsuario(c)?.id ?? null, c.req.param("id"))); } catch (e) { return falha(c, e); }
  })
  .get("/compras-diretas", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      const itens = await prisma.itemOperacao.findMany({ where: { estocavel: false, produtoId: { not: null }, operacao: { tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA", ...(propriedadeId == null ? {} : { propriedadeId }) } },
        select: { id: true, produtoId: true, quantidade: true, unidade: true, produto: { select: { nome: true } }, operacao: { select: { numero: true, data: true } } }, take: 100 });
      const resposta = await Promise.all(itens.map(async (item) => {
        const soma = await prisma.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: item.id, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true } });
        return { ...item, disponivel: item.quantidade.minus(soma._sum.quantidadeCompraDireta ?? 0).toString() };
      }));
      return c.json(resposta.filter((i) => new Prisma.Decimal(i.disponivel).gt(0)));
    } catch (e) { return falha(c, e); }
  })
  .get("/tipos-aplicacao", async (c) => { try { return c.json(await tipos.listarTiposAplicacao()); } catch (e) { return falha(c, e); } })
  .post("/tipos-aplicacao", validar(z.object({ nome: z.string().trim().min(2).max(120) })), async (c) => {
    try { return c.json(await tipos.salvarTipoAplicacao(c.req.valid("json"), getUsuario(c)?.id ?? null), 201); } catch (e) { return falha(c, e); }
  })
  .patch("/tipos-aplicacao/:id", validar(z.object({ nome: z.string().trim().min(2).max(120).optional(), ativo: z.boolean().optional() })), async (c) => {
    try { if (!uuid.safeParse(c.req.param("id")).success) return c.json({ error: "Tipo inválido" }, 422);
      return c.json(await tipos.salvarTipoAplicacao(c.req.valid("json"), getUsuario(c)?.id ?? null, c.req.param("id"))); } catch (e) { return falha(c, e); }
  })
  .get("/doencas", async (c) => { try { return c.json(await ocorrencias.listarDoencas()); } catch (e) { return falha(c, e); } })
  .post("/doencas", validar(z.object({ nome: z.string().trim().min(2).max(120), motivoBaixaSugeridoId: uuid.nullish() })), async (c) => {
    try { const body = c.req.valid("json"); return c.json(await ocorrencias.criarDoenca(body.nome, body.motivoBaixaSugeridoId ?? null, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/ocorrencias", async (c) => {
    try {
      const animalId = c.req.query("animalId");
      if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json(await ocorrencias.listarOcorrencias(animalId, await resolverEscopoLeitura(c), consultaSanitariaSchema.parse(c.req.query())));
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
  .get("/protocolos", async (c) => { try { return c.json(await protocolos.listarProtocolos()); } catch (e) { return falha(c, e); } })
  .post("/protocolos", validar(z.object({ nome: z.string().trim().min(2).max(160), descricao: z.string().trim().max(500).nullish(),
    etapas: z.array(z.object({ diaRelativo: z.number().int().nonnegative(), tipo: z.enum(["APLICACAO", "EXAME"]),
      produtoId: uuid.nullish(), tipoExameId: uuid.nullish(), tipoAplicacaoId: uuid.nullish(), finalidade: z.enum(["TRATAMENTO", "VACINA", "VERMIFUGO"]).nullish(),
      dose: z.number().positive().nullish(), unidade: z.string().trim().max(30).nullish(), via: z.string().trim().max(80).nullish() })).min(1),
  })), async (c) => {
    try { return c.json(await protocolos.criarProtocolo(c.req.valid("json"), getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .post("/protocolos/:id/publicacao", async (c) => {
    try { return c.json(await protocolos.publicarProtocolo(c.req.param("id"), getUsuario(c)?.id ?? null)); }
    catch (e) { return falha(c, e); }
  })
  .post("/execucoes", validar(z.object({ protocoloId: uuid, animalId: uuid, propriedadeId: z.number().int().positive(),
    inicio: data, ocorrenciaId: uuid.nullish(), operacaoServicoId: uuid.nullish() })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await protocolos.iniciarExecucao({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/tarefas", async (c) => {
    try { const animalId = c.req.query("animalId"); if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json(await protocolos.listarTarefas(await resolverEscopoLeitura(c), animalId, consultaSanitariaSchema.parse(c.req.query()))); }
    catch (e) { return falha(c, e); }
  })
  .post("/tarefas/:id/dispensa", validar(z.object({ motivo: z.string().trim().min(5).max(500) })), async (c) => {
    try { const propriedadeId = await resolverEscopoEscrita(c); return c.json(await protocolos.dispensarTarefa(c.req.param("id"), c.req.valid("json").motivo, getUsuario(c)?.id ?? null, propriedadeId)); }
    catch (e) { return falha(c, e); }
  })
  .post("/execucoes/:id/cancelamento", validar(z.object({ propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      const salvo = await protocolos.cancelarExecucao(c.req.param("id"), propriedadeId, body.motivo, getUsuario(c)?.id ?? null); return c.json({ ...salvo, valorServicoAtribuido: podeVerCustos(c) ? salvo.valorServicoAtribuido : null }); } catch (e) { return falha(c, e); }
  })
  .get("/tipos-exame", async (c) => { try { return c.json(await exames.listarTiposExame()); } catch (e) { return falha(c, e); } })
  .post("/tipos-exame", validar(z.object({ nome: z.string().trim().min(2).max(120), tipoResultado: z.enum(["TEXTO", "NUMERO", "OPCAO"]),
    unidade: z.string().trim().max(30).nullish(), opcoes: z.array(z.string().trim().min(1).max(100)).max(30).nullish() })), async (c) => {
    try { return c.json(await exames.criarTipoExame(c.req.valid("json"), getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/exames", async (c) => {
    try { const animalId = c.req.query("animalId"); if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      const lista = await exames.listarExames(animalId, await resolverEscopoLeitura(c), consultaSanitariaSchema.parse(c.req.query()));
      return c.json(lista.map((e) => ({ ...e, valorServicoAtribuido: podeVerCustos(c) ? e.valorServicoAtribuido : null }))); }
    catch (e) { return falha(c, e); }
  })
  .post("/exames", validar(z.object({ animalId: uuid, propriedadeId: z.number().int().positive(), tipoExameId: uuid, data,
    resultadoTexto: z.string().trim().max(1000).nullish(), resultadoNumero: z.number().finite().nullish(), resultadoOpcao: z.string().trim().max(100).nullish(),
    responsavel: z.string().trim().max(160).nullish(), ocorrenciaId: uuid.nullish(), tarefaId: uuid.nullish(), operacaoServicoId: uuid.nullish() })), async (c) => {
    try { const body = c.req.valid("json"); const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await exames.registrarExame({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), 201); }
    catch (e) { return falha(c, e); }
  })
  .get("/aplicacoes", async (c) => {
    try {
      const animalId = c.req.query("animalId");
      if (animalId && !uuid.safeParse(animalId).success) return c.json({ error: "Animal inválido", code: "VALIDACAO" }, 422);
      return c.json((await aplicacoes.listarAplicacoes(animalId, await resolverEscopoLeitura(c), consultaSanitariaSchema.parse(c.req.query()))).map((a) => ocultarCustos(a, c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/aplicacoes", validar(aplicacaoSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(ocultarCustos(await aplicacoes.criarAplicacao({ ...body, propriedadeId }, getUsuario(c)?.id ?? null), c), 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/carencias", zValidator("query", consultaSanitariaSchema), async (c) => {
    try { return c.json(await aplicacoes.listarCarencias(await resolverEscopoLeitura(c), c.req.valid("query"))); }
    catch (e) { return falha(c, e); }
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
