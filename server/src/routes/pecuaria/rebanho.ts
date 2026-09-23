import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../../db.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";
import { getUsuario } from "../../middleware/permissao.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import * as animais from "../../services/pecuaria/rebanho/animais.js";
import * as lotes from "../../services/pecuaria/rebanho/lotes.js";
import * as racas from "../../services/pecuaria/rebanho/racas.js";
import * as motivos from "../../services/pecuaria/rebanho/motivos.js";
import * as painel from "../../services/pecuaria/rebanho/painel.js";
import {
  cadastrarAnimalSchema, editarAnimalSchema, movimentarSchema, mudarDestinoSchema,
  saidaSchema, estornoSaidaSchema, pesagemSchema, editarPesagemSchema, listarFiltrosSchema,
  criarLoteSchema, editarLoteSchema, incluirInativosQuerySchema,
  substituirComposicaoSchema, criarRacaSchema, editarRacaSchema,
  criarMotivoSaidaSchema, editarMotivoSaidaSchema,
} from "../../services/pecuaria/rebanho/schemas.js";

function usuarioId(c: Context): number | null {
  const u = getUsuario(c);
  return u && u.id > 0 ? u.id : null;
}

function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code, ...(erro.campo ? { campo: erro.campo } : {}) }, status);
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

export const rebanhoRouter = new Hono()
  .get("/animais", zValidator("query", listarFiltrosSchema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  }), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.listar(c.req.valid("query"), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais", validar(cadastrarAnimalSchema), async (c) => {
    const body = c.req.valid("json");
    const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
    try {
      return c.json(await animais.cadastrar({ ...body, propriedadeId }, usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id", idParam, async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.buscarFicha(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .patch("/animais/:id", idParam, validar(editarAnimalSchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.editar(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .put("/animais/:id/composicao", idParam, validar(substituirComposicaoSchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.substituirComposicao(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/animais/:id/auditoria", idParam, async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.buscarAuditoriaAnimal(c.req.valid("param").id, escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/movimentar", validar(movimentarSchema), async (c) => {
    const body = c.req.valid("json");
    const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
    const escopoOrigem = await resolverEscopoLeitura(c);
    try {
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
  .post("/animais/:id/saida", idParam, validar(saidaSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(await animais.darSaida({ ...body, animalId: c.req.valid("param").id }, usuarioId(c), await resolverEscopoLeitura(c)));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/saida/estorno", idParam, validar(estornoSaidaSchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.estornarSaida(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .post("/animais/:id/pesagens", idParam, validar(pesagemSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(await animais.registrarPesagem({ ...body, animalId: c.req.valid("param").id }, usuarioId(c), await resolverEscopoLeitura(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/pesagens/:id", idParam, validar(editarPesagemSchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await animais.editarPesagem(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
    } catch (e) { return falha(c, e); }
  })
  .delete("/pesagens/:id", idParam, async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      await animais.excluirPesagem(c.req.valid("param").id, usuarioId(c), escopo);
      return c.json({ ok: true });
    } catch (e) { return falha(c, e); }
  })
  .get("/lotes", validarQuery(incluirInativosQuerySchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    return c.json(await lotes.listarLotes(escopo, c.req.valid("query").incluirInativos));
  })
  .post("/lotes", validar(criarLoteSchema), async (c) => {
    const body = c.req.valid("json");
    const propriedadeId = await resolverEscopoEscrita(c, body.propriedadeId);
    try {
      return c.json(await lotes.criarLote({ ...body, propriedadeId }, usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/lotes/:id", idParam, validar(editarLoteSchema), async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await lotes.editarLote(c.req.valid("param").id, c.req.valid("json"), usuarioId(c), escopo));
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
  .get("/motivos-saida", validarQuery(incluirInativosQuerySchema), async (c) => {
    return c.json(await motivos.listarMotivosSaida(c.req.valid("query").incluirInativos));
  })
  .post("/motivos-saida", validar(criarMotivoSaidaSchema), async (c) => {
    try {
      return c.json(await motivos.criarMotivoSaida(c.req.valid("json"), usuarioId(c)), 201);
    } catch (e) { return falha(c, e); }
  })
  .patch("/motivos-saida/:id", idParam, validar(editarMotivoSaidaSchema), async (c) => {
    try {
      return c.json(await motivos.editarMotivoSaida(c.req.valid("param").id, c.req.valid("json"), usuarioId(c)));
    } catch (e) { return falha(c, e); }
  })
  .get("/painel", async (c) => {
    const escopo = await resolverEscopoLeitura(c);
    try {
      return c.json(await painel.buscarPainelGeral(escopo));
    } catch (e) { return falha(c, e); }
  })
  .get("/catalogos", async (c) => {
    const [racasAtivas, motivosSaida, propriedades, lotesAtivos] = await Promise.all([
      prisma.raca.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      prisma.motivoSaida.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      prisma.propriedade.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] }),
      prisma.lote.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    ]);
    return c.json({
      racas: racasAtivas.map((r) => ({ id: r.id, nome: r.nome, sigla: r.sigla, base: r.base })),
      motivosSaida: motivosSaida.map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo })),
      propriedades: propriedades.map((p) => ({ id: p.id, nome: p.nome, apelido: p.apelido })),
      lotes: lotesAtivos.map((l) => ({ id: l.id, nome: l.nome, propriedadeId: l.propriedadeId })),
    });
  });
