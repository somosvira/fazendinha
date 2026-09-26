import { Hono, type Context, type MiddlewareHandler } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { resolverEscopoLeitura, resolverEscopoEscrita, PropriedadeError } from "../../services/propriedade.js";
import { getUsuario, exigePermissao } from "../../middleware/permissao.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import * as animais from "../../services/pecuaria/rebanho/animais.js";
import * as lotes from "../../services/pecuaria/rebanho/lotes.js";
import * as racas from "../../services/pecuaria/rebanho/racas.js";
import * as motivos from "../../services/pecuaria/rebanho/motivos.js";
import * as painel from "../../services/pecuaria/rebanho/painel.js";
import * as movimentacoes from "../../services/pecuaria/rebanho/movimentacoes.js";
import * as categorias from "../../services/pecuaria/rebanho/categorias.js";
import * as genitores from "../../services/pecuaria/rebanho/genitores.js";
import * as materialGenetico from "../../services/pecuaria/rebanho/materialGenetico.js";
import {
  cadastrarAnimalSchema, editarAnimalSchema, movimentarSchema, mudarDestinoSchema,
  baixaSchema, estornoBaixaSchema, pesagemSchema, editarPesagemSchema, listarFiltrosSchema,
  criarLoteSchema, editarLoteSchema, incluirInativosQuerySchema,
  substituirComposicaoSchema, criarRacaSchema, editarRacaSchema,
  criarMotivoBaixaSchema, editarMotivoBaixaSchema, desfazerMovimentacaoSchema, paginaQuerySchema, listarMovimentacoesSchema,
  criarCategoriaSchema, editarCategoriaSchema, simularCategoriasSchema, reordenarCategoriasSchema, restaurarPadroesSchema,
  categoriaManualSchema, removerCategoriaManualSchema,
  gmdPeriodoQuerySchema, painelQuerySchema, auditoriaAnimalQuerySchema, auditoriaCadastroQuerySchema,
  criarGenitorSchema, editarGenitorSchema, substituirComposicaoGenitorSchema, listarGenitoresQuerySchema, definirFiliacaoSchema,
  criarMaterialGeneticoSchema, editarMaterialGeneticoSchema, listarMaterialGeneticoQuerySchema,
} from "../../services/pecuaria/rebanho/schemas.js";

function usuarioId(c: Context): number | null {
  const u = getUsuario(c);
  return u && u.id > 0 ? u.id : null;
}

/**
 * Erros do banco que são corrida entre duas escritas (duplo clique, duas abas), não bug: viram
 * 409 para a tela pedir recarga, em vez de 500.
 * - P2002: violação de único — inclusive os índices parciais "uma linha aberta por animal";
 * - P2025: o registro sumiu/mudou entre a leitura e a escrita;
 * - P2034: conflito de escrita ou deadlock detectado pelo Postgres.
 */
const MENSAGENS_CONFLITO_PRISMA: Record<string, string> = {
  P2002: "Registro alterado ao mesmo tempo por outra pessoa. Recarregue e tente de novo.",
  P2025: "O registro foi alterado ou removido por outra pessoa. Recarregue e tente de novo.",
  P2034: "Registro alterado ao mesmo tempo por outra pessoa. Recarregue e tente de novo.",
};

function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code, ...(erro.campo ? { campo: erro.campo } : {}) }, status);
  }
  // X-Propriedade-Id malformado ou fora da faixa do Postgres (S2) — sem isto o valor passaria
  // pro Prisma e voltaria como erro cru de banco (500)
  if (erro instanceof PropriedadeError && erro.code === "ESCOPO_INVALIDO") {
    return c.json({ error: erro.message, code: erro.code }, 400);
  }
  if (erro instanceof Prisma.PrismaClientKnownRequestError && MENSAGENS_CONFLITO_PRISMA[erro.code]) {
    return c.json({ error: MENSAGENS_CONFLITO_PRISMA[erro.code], code: "CONFLITO" }, 409);
  }
  console.error("[pecuaria/rebanho]", erro);
  return c.json({ error: "Erro inesperado ao processar a solicitação" }, 500);
}

const idParam = zValidator("param", z.object({ id: z.string().uuid() }), (resultado, c) => {
  if (!resultado.success) return c.json({ error: "Identificador inválido", code: "NAO_ENCONTRADO" }, 404);
});

function validar<T extends z.ZodTypeAny>(schema: T) {
  return zValidator("json", schema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  });
}

function validarQuery<T extends z.ZodTypeAny>(schema: T) {
  return zValidator("query", schema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  });
}

/**
 * Toda escrita no rebanho (qualquer método != GET — cadastro, edição, movimentação,
 * baixa, pesagem, lotes, raças, motivos de baixa) exige a flag `lancar`. Leitura só
 * depende do gate de área (`exigeArea("pecuaria")` em app.ts).
 */
const exigirLancarParaEscrita: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "GET") return next();
  return exigePermissao("lancar")(c, next);
};

export const rebanhoRouter = new Hono()
  .use("*", exigirLancarParaEscrita)
  .get("/animais", zValidator("query", listarFiltrosSchema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  }), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.listar(c.req.valid("query"), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais", validar(cadastrarAnimalSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await animais.cadastrar({ ...body, propriedadeId }, usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id", idParam, validarQuery(gmdPeriodoQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      const { periodoDias } = c.req.valid("query");
      return c.json(await animais.buscarFicha(c.req.valid("param").id, escopo, periodoDias));
    } catch (e) { return falha(c, e); }
  })
  .patch("/animais/:id", idParam, validar(editarAnimalSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.editar(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .put("/animais/:id/composicao", idParam, validar(substituirComposicaoSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      const { origem, ...input } = c.req.valid("json");
      return c.json(await animais.substituirComposicao(c.req.valid("param").id, input, usuarioId(c), escopo, origem));
    } catch (e) { return falha(c, e); }
  })
  .put("/animais/:id/filiacao", idParam, validar(definirFiliacaoSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.definirFiliacao(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id/filhos", idParam, async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.listarFilhos(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id/composicao-sugerida", idParam, async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.composicaoSugerida(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id/auditoria", idParam, validarQuery(auditoriaAnimalQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      const { page, pageSize } = c.req.valid("query");
      return c.json(await animais.buscarAuditoriaAnimal(c.req.valid("param").id, escopo, page, pageSize));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/movimentar", validar(movimentarSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      const escopoOrigem = await resolverEscopoLeitura(c);
      return c.json(await animais.movimentar({ ...body, propriedadeId }, usuarioId(c), escopoOrigem));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/destino", idParam, validar(mudarDestinoSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(await animais.mudarDestino({ ...body, animalId: c.req.valid("param").id }, usuarioId(c), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/localizacao/desfazer", idParam, async (c) => {
    try {
      return c.json(await animais.desfazerLocalizacao(c.req.valid("param").id, usuarioId(c), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/destino/desfazer", idParam, async (c) => {
    try {
      return c.json(await animais.desfazerDestino(c.req.valid("param").id, usuarioId(c), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/baixa", idParam, validar(baixaSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(await animais.darBaixa({ ...body, animalId: c.req.valid("param").id }, usuarioId(c), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/baixa/estorno", idParam, validar(estornoBaixaSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.estornarBaixa(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/categoria", idParam, validar(categoriaManualSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.definirCategoriaManual(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/categoria/remover", idParam, validar(removerCategoriaManualSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.removerCategoriaManual(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/pesagens", idParam, validar(pesagemSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(await animais.registrarPesagem({ ...body, animalId: c.req.valid("param").id }, usuarioId(c), await resolverEscopoLeitura(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/pesagens/:id", idParam, validar(editarPesagemSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.editarPesagem(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .delete("/pesagens/:id", idParam, async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      await animais.excluirPesagem(c.req.valid("param").id, usuarioId(c), escopo);
      return c.json({ ok: true });
    } catch (e) { return falha(c, e); }
  })
  .get("/lotes", validarQuery(incluirInativosQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await lotes.listarLotes(escopo, c.req.valid("query").incluirInativos));
    } catch (e) { return falha(c, e); }
  })
  .get("/lotes/:id", idParam, async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await lotes.buscarLote(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/lotes/:id/resumo", idParam, validarQuery(gmdPeriodoQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      const { periodoDias } = c.req.valid("query");
      return c.json(await lotes.buscarResumoLote(c.req.valid("param").id, periodoDias, escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/lotes/:id/movimentacoes", idParam, validarQuery(paginaQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await movimentacoes.listarMovimentacoesDoLote(c.req.valid("param").id, escopo, c.req.valid("query").page));
    } catch (e) { return falha(c, e); }
  })
  .get("/movimentacoes", validarQuery(listarMovimentacoesSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await movimentacoes.listarMovimentacoes(c.req.valid("query"), escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/movimentacoes/:id", idParam, async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await movimentacoes.buscarMovimentacao(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/movimentacoes/:id/desfazer", idParam, validar(desfazerMovimentacaoSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await animais.desfazerMovimentacao(c.req.valid("param").id, c.req.valid("json").motivo, usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/lotes", validar(criarLoteSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
      return c.json(await lotes.criarLote({ ...body, propriedadeId }, usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/lotes/:id", idParam, validar(editarLoteSchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(await lotes.editarLote(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/categorias", validarQuery(incluirInativosQuerySchema), async (c) => {
    return c.json(await categorias.listarCategorias(c.req.valid("query").incluirInativos));
  })
  .post("/categorias", validar(criarCategoriaSchema), async (c) => {
    try {
      return c.json(await categorias.criarCategoria(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .post("/categorias/simular", validar(simularCategoriasSchema), async (c) => {
    try {
      return c.json(await categorias.simularCategorias(c.req.valid("json").regras));
    } catch (e) { return falha(c, e); }
  })
  .post("/categorias/ordem", validar(reordenarCategoriasSchema), async (c) => {
    try {
      await categorias.reordenarCategorias(c.req.valid("json").ids, usuarioId(c));
      return c.json({ ok: true });
    } catch (e) { return falha(c, e); }
  })
  .post("/categorias/restaurar-padroes", validar(restaurarPadroesSchema), async (c) => {
    try {
      return c.json(await categorias.restaurarPadroes(c.req.valid("json").simular, usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .patch("/categorias/:id", idParam, validar(editarCategoriaSchema), async (c) => {
    try {
      return c.json(await categorias.editarCategoria(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/racas", validarQuery(incluirInativosQuerySchema), async (c) => {
    return c.json(await racas.listarRacas(c.req.valid("query").incluirInativos));
  })
  .post("/racas", validar(criarRacaSchema), async (c) => {
    try {
      return c.json(await racas.criarRaca(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/racas/:id", idParam, validar(editarRacaSchema), async (c) => {
    try {
      return c.json(await racas.editarRaca(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/genitores", validarQuery(listarGenitoresQuerySchema), async (c) => {
    return c.json(await genitores.listarGenitores(c.req.valid("query")));
  })
  .post("/genitores", validar(criarGenitorSchema), async (c) => {
    try {
      return c.json(await genitores.criarGenitor(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/genitores/:id", idParam, validar(editarGenitorSchema), async (c) => {
    try {
      return c.json(await genitores.editarGenitor(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .put("/genitores/:id/composicao", idParam, validar(substituirComposicaoGenitorSchema), async (c) => {
    try {
      return c.json(await genitores.substituirComposicaoGenitor(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/material-genetico", validarQuery(listarMaterialGeneticoQuerySchema), async (c) => {
    try {
      return c.json(await materialGenetico.listarMaterialGenetico(c.req.valid("query"), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/material-genetico", validar(criarMaterialGeneticoSchema), async (c) => {
    try {
      return c.json(await materialGenetico.criarMaterialGenetico(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/material-genetico/:id", idParam, validar(editarMaterialGeneticoSchema), async (c) => {
    try {
      return c.json(await materialGenetico.editarMaterialGenetico(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/motivos-baixa", validarQuery(incluirInativosQuerySchema), async (c) => {
    return c.json(await motivos.listarMotivosBaixa(c.req.valid("query").incluirInativos));
  })
  .post("/motivos-baixa", validar(criarMotivoBaixaSchema), async (c) => {
    try {
      return c.json(await motivos.criarMotivoBaixa(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/motivos-baixa/:id", idParam, validar(editarMotivoBaixaSchema), async (c) => {
    try {
      return c.json(await motivos.editarMotivoBaixa(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/painel", validarQuery(painelQuerySchema), async (c) => {
    try {
      const escopo = await resolverEscopoLeitura(c);
      const { periodoDias } = c.req.valid("query");
      return c.json(await painel.buscarPainelGeral(escopo, periodoDias));
    } catch (e) { return falha(c, e); }
  })
  .get("/auditoria", validarQuery(auditoriaCadastroQuerySchema), async (c) => {
    try {
      const { entidade, entidadeId, page, pageSize } = c.req.valid("query");
      return c.json(await animais.buscarAuditoriaCadastro(entidade, entidadeId, page, pageSize));
    } catch (e) { return falha(c, e); }
  })
  .get("/catalogos", async (c) => {
    const [racasAtivas, motivosBaixa, propriedades, lotesAtivos] = await Promise.all([
      prisma.raca.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      prisma.motivoBaixa.findMany({ where: { ativo: true }, orderBy: [{ classe: "asc" }, { nome: "asc" }] }),
      prisma.propriedade.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] }),
      prisma.lote.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    ]);
    return c.json({
      racas: racasAtivas.map((r) => ({ id: r.id, nome: r.nome, sigla: r.sigla, base: r.base })),
      motivosBaixa: motivosBaixa.map((m) => ({ id: m.id, nome: m.nome, classe: m.classe })),
      propriedades: propriedades.map((p) => ({ id: p.id, nome: p.nome, apelido: p.apelido })),
      lotes: lotesAtivos.map((l) => ({ id: l.id, nome: l.nome, propriedadeId: l.propriedadeId })),
    });
  });
