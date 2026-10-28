import { AlertaError } from "../../services/alertas/erros.js";
import { consultarAgendaUnificada, consultaAgendaUnificadaSchema } from "../../services/pecuaria/sanidade/programacoes/agenda.js";
import { previaRevisaoProgramacao, revisarProgramacao } from "../../services/pecuaria/sanidade/programacoes/gestao.js";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { resolverEscopoLeitura, PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { cadastroProgramacaoSchema, consultaProgramacoesSchema } from "../../services/pecuaria/sanidade/programacoes/schemas.js";
import { previaAtivacaoProgramacao, ativarProgramacao } from "../../services/pecuaria/sanidade/programacoes/ativacao.js";
import { cadastrarProgramacao, consultarProgramacoes, listarSitiosExportacao, listarCadastrosProgramacoes, obterCadastroProgramacao } from "../../services/pecuaria/sanidade/programacoes/consulta.js";
function falha(c: Context, e: unknown) {
  if (e instanceof z.ZodError) return c.json({ error: e.issues[0].message, code: "VALIDACAO", campo: e.issues[0].path.join(".") }, 422);
  if (e instanceof PropriedadeError) return c.json({ error: e.message, code: e.code }, 422);
  if (e instanceof RebanhoError || e instanceof AlertaError) return c.json({ error: e.message, code: e.code, campo: e.campo }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
  console.error("[programacoes-sanitarias]", e); return c.json({ error: "Erro ao processar programação sanitária" }, 500);
}
export const programacoesSanitariasRouter = new Hono()
  .use("*", async (c, next) => {
    const usuario = getUsuario(c);
    if (!usuario || usuario.id <= 0 || usuario.status !== "ATIVO") return c.json({ error: "É necessária uma sessão real ativa" }, 401);
    if (!temArea(usuario, "pecuaria")) return c.json({ error: "Sem acesso a Pecuária" }, 403);
    return next();
  })
  .post("/:id/previa-revisao", async c => {
    try { const u = getUsuario(c)!; if (!temPermissao(u, "lancar") || !(u.dono || u.abas.includes("cadastros"))) return c.json({ error: "Sem permissão de gestão" }, 403);
      const body = z.object({ propriedadeId: z.number().int().positive() }).strict().parse(await c.req.json()); const escopo = await resolverEscopoLeitura(c);
      if (escopo != null && escopo !== body.propriedadeId) return c.json({ error: "Sítio fora do escopo" }, 403);
      return c.json(await previaRevisaoProgramacao(z.string().uuid().parse(c.req.param("id")), body.propriedadeId)); } catch(e) { return falha(c,e); }
  })
  .post("/:id/revisao", async c => {
    try { const u = getUsuario(c)!; if (!temPermissao(u, "lancar") || !(u.dono || u.abas.includes("cadastros"))) return c.json({ error: "Sem permissão de gestão" }, 403);
      const body = z.object({ propriedadeId: z.number().int().positive(), revisao: z.number().int().positive(), chavePrevia: z.string().length(64), motivo: z.string().trim().min(5).max(500), destinoAbertas: z.enum(["MANTER", "ENCERRAR"]), cadastro: cadastroProgramacaoSchema.optional() }).strict().parse(await c.req.json());
      const escopo = await resolverEscopoLeitura(c); if (escopo != null && escopo !== body.propriedadeId) return c.json({ error: "Sítio fora do escopo" }, 403);
      return c.json(await revisarProgramacao(z.string().uuid().parse(c.req.param("id")), body.propriedadeId, body, u.id)); } catch(e) { return falha(c,e); }
  })
  .get("/cadastros", async c => {
    try { return c.json(await listarCadastrosProgramacoes(await resolverEscopoLeitura(c))); } catch(e) { return falha(c,e); }
  })
  .get("/:id/cadastro", async c => {
    try { return c.json(await obterCadastroProgramacao(z.string().uuid().parse(c.req.param("id")), await resolverEscopoLeitura(c))); } catch(e) { return falha(c,e); }
  })
  .get("/agenda-unificada", async c => {
    try { return c.json(await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse(c.req.query()), await resolverEscopoLeitura(c))); } catch(e) { return falha(c,e); }
  })
  .get("/exportacao", async c => {
    try {
      if (!temPermissao(getUsuario(c)!, "exportar")) return c.json({ error: "Sem permissão para exportar" }, 403);
      const filtro = consultaProgramacoesSchema.parse(c.req.query());
      if (filtro.mes || filtro.busca || filtro.tipo) return c.json({ error: "O PDF anual usa o calendário completo do escopo selecionado" }, 422);
      const escopo = await resolverEscopoLeitura(c);
      const resultado = await consultarProgramacoes({ ...filtro, pagina: 1, tamanho: 100 }, escopo);
      const sitios = await listarSitiosExportacao(escopo);
      return c.json({ ...resultado, itens: resultado.meses.flatMap(m => m.eventos), meta: { ano: filtro.ano, escopo: escopo == null ? "CONSOLIDADO" : "SITIO", sitios, completo: true, filtros: null } });
    } catch (e) { return falha(c, e); }
  })
  .get("/", async c => {
    try { const filtro = consultaProgramacoesSchema.parse(c.req.query()); return c.json(await consultarProgramacoes(filtro, await resolverEscopoLeitura(c))); }
    catch (e) { return falha(c, e); }
  })
  .post("/:id/previa", async c => {
    try {
      const usuario = getUsuario(c)!;
      if (!(temPermissao(usuario, "lancar") && (usuario.dono || usuario.abas.includes("cadastros")))) return c.json({ error: "Sem permissão para gerir programações" }, 403);
      const id = z.string().uuid().parse(c.req.param("id"));
      const body = z.object({ propriedadeId: z.number().int().positive() }).strict().parse(await c.req.json());
      const escopo = await resolverEscopoLeitura(c);
      if (escopo != null && escopo !== body.propriedadeId) return c.json({ error: "Programação fora do sítio selecionado" }, 403);
      return c.json(await previaAtivacaoProgramacao(id, body.propriedadeId));
    } catch (e) { return falha(c, e); }
  })
  .post("/:id/ativacao", async c => {
    try {
      const usuario = getUsuario(c)!;
      if (!(temPermissao(usuario, "lancar") && (usuario.dono || usuario.abas.includes("cadastros")))) return c.json({ error: "Sem permissão para gerir programações" }, 403);
      const id = z.string().uuid().parse(c.req.param("id"));
      const body = z.object({ propriedadeId: z.number().int().positive(), revisao: z.number().int().positive(), chavePrevia: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(await c.req.json());
      const escopo = await resolverEscopoLeitura(c);
      if (escopo != null && escopo !== body.propriedadeId) return c.json({ error: "Programação fora do sítio selecionado" }, 403);
      return c.json(await ativarProgramacao(id, body.propriedadeId, body, usuario.id));
    } catch (e) { return falha(c, e); }
  })
  .post("/", async c => {
    try {
      const usuario = getUsuario(c)!;
      if (!(temPermissao(usuario, "lancar") && (usuario.dono || usuario.abas.includes("cadastros")))) return c.json({ error: "Sem permissão para gerir programações" }, 403);
      const input = cadastroProgramacaoSchema.parse(await c.req.json());
      const escopo = await resolverEscopoLeitura(c);
      if (escopo != null && escopo !== input.propriedadeId) return c.json({ error: "Programação fora do sítio selecionado" }, 403);
      return c.json(await cadastrarProgramacao(input, usuario.id), 201);
    } catch (e) { return falha(c, e); }
  });
