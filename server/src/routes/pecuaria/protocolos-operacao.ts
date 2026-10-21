import { listarInsercoesTarefa,listarServicosManejo } from "../../services/pecuaria/protocolos/execucao.manejos.js";
import { reconhecerInsercaoDispositivo,reconhecerInsercaoSchema,listarAplicacoesReconhecerInsercao,listarManejosProtocolosAnimal,obterManejoProtocolar,anularManejoProtocolar,corrigirManejoProtocolar,corrigirManejoProtocoloSchema,regularizarManejoProtocolar } from "../../services/pecuaria/protocolos/manejos-correcao.js";
import { anularManejoProtocoloSchema } from "../../services/pecuaria/protocolos/execucao.manejos.schemas.js";
import { regularizacaoSchema } from "../../services/pecuaria/reproducao/schemas.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { execucaoProtocoloSchema, confirmarExecucaoProtocoloSchema, paginaExecucaoSchema } from "../../services/pecuaria/protocolos/execucao.schemas.js";
import { preverExecucaoProtocolo, confirmarExecucaoProtocolo, obterReciboExecucaoProtocolo } from "../../services/pecuaria/protocolos/execucao.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { EstoqueError } from "../../services/estoque/estoque.js";
import { ValorizacaoError } from "../../services/estoque/valorizacao.calc.js";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { PropriedadeError, resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { conflitoTransacaoPecuaria } from "../../services/pecuaria/transacao.js";
import { eventoTarefaSchema, registrarEventoTarefa } from "../../services/pecuaria/protocolos/eventos.js";
import { consultaOperacaoSchema, listaOperacaoSchema, consultaVersoesOperacaoSchema, consultaVinculosColetivosOperacaoSchema, consultaOrigensFatoOperacaoSchema, type ContextoOperacao } from "../../services/pecuaria/protocolos/operacao.schemas.js";
import * as consultas from "../../services/pecuaria/protocolos/operacao.js";
import { criarParticipacaoIndividualReprodutiva, preverInicioExecucaoTarefa, previaInicioExecucaoSchema } from "../../services/pecuaria/reproducao/iatf.js";
import { iniciarExecucao } from "../../services/pecuaria/sanidade/protocolos.js";
import { listarExamesTarefaClinica,listarOpcoesClinicas } from "../../services/pecuaria/protocolos/opcoes-clinicas.js";

const uuid = z.string().uuid();
const participacaoSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive().max(2147483647),
  tipo: z.enum(["SANITARIO", "REPRODUTIVO"]), protocoloId: uuid, animalId: uuid,
  inicioReferencia: z.union([z.string().date(), z.string().datetime({ offset: true })]),
  cienciaSanitaria: z.boolean().optional(), confirmarSobreposicao: z.boolean().optional(),
  justificativaSobreposicao: z.string().trim().min(5).max(1000).optional(),
}).strict();
const previaSchema = participacaoSchema.omit({ chave: true }).extend({ chave: uuid.optional(), pagina: z.number().int().positive().default(1), porPagina: z.number().int().min(1).max(10).default(10) });
const usuarioId = (c: Context) => { const id = getUsuario(c)?.id; return id != null && id > 0 ? id : null; };
function consulta(c: Context) {
  const { propriedadeId: _sitio, ...filtros } = c.req.query();
  return consultaOperacaoSchema.parse(filtros);
}
function falha(c: Context, erro: unknown) {
  if (erro instanceof z.ZodError) return c.json({ error: erro.issues[0]?.message ?? "Dados inválidos", code: "VALIDACAO", campo: erro.issues[0]?.path.join(".") }, 422);
  if (erro instanceof PropriedadeError) return c.json({ error: erro.message, code: erro.code }, 400);
  if (erro instanceof RebanhoError || erro instanceof FinanceiroError || erro instanceof EstoqueError) return c.json({ error: erro.message, code: erro.code, campo: erro.campo }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof ValorizacaoError) return c.json({ error: erro.message, code: erro.code }, erro.code === "VALIDACAO" ? 422 : 409);
  if (conflitoTransacaoPecuaria(erro) || erro && typeof erro === "object" && "code" in erro && ["P2002", "P2025"].includes(String(erro.code)))
    return c.json({ error: "Os dados mudaram. Atualize o protocolo e confira novamente.", code: "CONFLITO" }, 409);
  console.error("[protocolos/operacao]", erro);
  return c.json({ error: "Não foi possível consultar ou atualizar o protocolo", code: "ERRO_INTERNO" }, 500);
}

export const protocolosOperacaoRouter = new Hono().use("*", async (c, next) => {
  const usuario = getUsuario(c);
  if (!usuario || !temArea(usuario, "pecuaria")) return c.json({ error: "Acesso à Pecuária necessário", code: "SEM_PERMISSAO" }, 403);
  const previa = c.req.method === "POST" && /\/participacoes\/previa\/?$/.test(c.req.path);
  if (c.req.method !== "GET" && !previa && !temPermissao(usuario, "lancar"))
    return c.json({ error: "Permissão para lançar necessária", code: "SEM_PERMISSAO" }, 403);
  await next();
});

protocolosOperacaoRouter.get("/origens-fato", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); return c.json(await consultas.listarOrigensFatoOperacao(await resolverEscopoLeitura(c), consultaOrigensFatoOperacaoSchema.parse(filtros))); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/vinculos-coletivos", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); const consulta = consultaVinculosColetivosOperacaoSchema.parse(filtros); return c.json(await consultas.listarVinculosColetivosOperacao(await resolverEscopoLeitura(c), consulta)); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/versoes", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); await resolverEscopoLeitura(c); return c.json(await consultas.listarVersoesOperacao(consultaVersoesOperacaoSchema.parse(filtros))); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/tarefas/:id/previa-execucao", async c => {
  try { const propriedadeId = await resolverEscopoEscrita(c); const input = previaInicioExecucaoSchema.parse({ propriedadeId, realizadaEm: c.req.query("realizadaEm"), pagina: Number(c.req.query("pagina") ?? 1), porPagina: Number(c.req.query("porPagina") ?? 10) }); return c.json(await preverInicioExecucaoTarefa(uuid.parse(c.req.param("id")), input)); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/tarefas/:id/opcoes-clinicas", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); return c.json(await listarOpcoesClinicas(uuid.parse(c.req.param("id")), await resolverEscopoLeitura(c), filtros)); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/participacoes", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); return c.json(await consultas.listarParticipacoesOperacao(await resolverEscopoLeitura(c), listaOperacaoSchema.parse(filtros))); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.get("/programacoes", async c => {
  try { const { propriedadeId: _sitio, ...filtros } = c.req.query(); return c.json(await consultas.listarProgramacoesOperacao(await resolverEscopoLeitura(c), listaOperacaoSchema.parse(filtros))); } catch (e) { return falha(c, e); }
});

protocolosOperacaoRouter.get("/programacoes/:id/participantes", async c => {
  try { return c.json(await consultas.listarParticipantesOperacao({ programacaoId: uuid.parse(c.req.param("id")) }, await resolverEscopoLeitura(c), consulta(c))); } catch (e) { return falha(c, e); }
});

for (const familia of ["programacoes", "participacoes"] as const) {
  const contexto = (c: Context): ContextoOperacao => familia === "programacoes" ? { programacaoId: uuid.parse(c.req.param("id")) } : { participacaoId: uuid.parse(c.req.param("id")) };
  protocolosOperacaoRouter.get(`/${familia}/:id`, async c => {
    try { return c.json(await consultas.obterCabecalhoOperacao(contexto(c), await resolverEscopoLeitura(c), getUsuario(c))); } catch (e) { return falha(c, e); }
  });
  protocolosOperacaoRouter.get(`/${familia}/:id/momentos`, async c => {
    try { return c.json(await consultas.listarMomentosOperacao(contexto(c), await resolverEscopoLeitura(c), consulta(c))); } catch(e) { return falha(c,e); }
  });
  protocolosOperacaoRouter.get(`/${familia}/:id/etapas`, async c => {
    try { return c.json(await consultas.listarEtapasOperacao(contexto(c), await resolverEscopoLeitura(c), consulta(c))); } catch (e) { return falha(c, e); }
  });
  protocolosOperacaoRouter.get(`/${familia}/:id/tarefas`, async c => {
    try { return c.json(await consultas.listarTarefasOperacao(contexto(c), await resolverEscopoLeitura(c), consulta(c), getUsuario(c))); } catch (e) { return falha(c, e); }
  });
  protocolosOperacaoRouter.get(`/${familia}/:id/procedimentos`, async c => {
    try { return c.json(await consultas.listarProcedimentosOperacao(contexto(c), await resolverEscopoLeitura(c), consulta(c), getUsuario(c))); } catch (e) { return falha(c, e); }
  });
}
protocolosOperacaoRouter.get("/tarefas/:id/eventos", async c => {
  try { return c.json(await consultas.listarEventosTarefaOperacao(uuid.parse(c.req.param("id")), await resolverEscopoLeitura(c), consulta(c))); } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.post("/tarefas/:id/eventos", async c => {
  try {
    const input = eventoTarefaSchema.parse(await c.req.json());
    return c.json(await registrarEventoTarefa(uuid.parse(c.req.param("id")), { ...input, propriedadeId: await resolverEscopoEscrita(c, input.propriedadeId) }, usuarioId(c)), 201);
  } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.post("/participacoes/previa", async c => {
  try {
    const input = previaSchema.parse(await c.req.json());
    return c.json(await consultas.preverParticipacaoIndividual({ tipo: input.tipo, protocoloId: input.protocoloId, animalId: input.animalId,
      inicioReferencia: input.inicioReferencia, pagina: input.pagina, porPagina: input.porPagina,
      propriedadeId: await resolverEscopoEscrita(c, input.propriedadeId) }));
  } catch (e) { return falha(c, e); }
});
protocolosOperacaoRouter.post("/participacoes", async c => {
  try {
    const { tipo, ...input } = participacaoSchema.parse(await c.req.json());
    const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
    const resultado = tipo === "REPRODUTIVO"
      ? await criarParticipacaoIndividualReprodutiva({ ...input, propriedadeId }, usuarioId(c))
      : await iniciarExecucao({ chave: input.chave, propriedadeId, protocoloId: input.protocoloId, animalId: input.animalId,
        inicio: z.string().date().parse(input.inicioReferencia), confirmarSobreposicao: input.confirmarSobreposicao, justificativaSobreposicao: input.justificativaSobreposicao }, usuarioId(c));
    return c.json({ id: resultado.id }, 201);
  } catch (e) { return falha(c, e); }
});

protocolosOperacaoRouter.post("/execucoes/previa", async c => {
  try {
    const input=execucaoProtocoloSchema.parse(await c.req.json());
    if(input.itens.some(i=>"valorServicoAtribuido" in i&&i.valorServicoAtribuido!=null)&&!podeVerValoresFinanceiros(getUsuario(c)??null))return c.json({error:"Permissão financeira para editar valores necessária",code:"SEM_PERMISSAO"},403);
    const propriedadeId=await resolverEscopoEscrita(c,input.propriedadeId);
    const f=paginaExecucaoSchema.parse({pagina:c.req.query("pagina"),porPagina:c.req.query("porPagina")});
    return c.json(await preverExecucaoProtocolo({...input,propriedadeId},f));
  } catch(e) { return falha(c,e); }
});
protocolosOperacaoRouter.post("/execucoes/confirmar", async c => {
  try {
    const input=confirmarExecucaoProtocoloSchema.parse(await c.req.json());
    if(input.execucao.itens.some(i=>"valorServicoAtribuido" in i&&i.valorServicoAtribuido!=null)&&!podeVerValoresFinanceiros(getUsuario(c)??null))return c.json({error:"Permissão financeira para editar valores necessária",code:"SEM_PERMISSAO"},403);
    const propriedadeId=await resolverEscopoEscrita(c,input.execucao.propriedadeId);
    return c.json(await confirmarExecucaoProtocolo({...input,execucao:{...input.execucao,propriedadeId}},usuarioId(c)),201);
  } catch(e) { return falha(c,e); }
});
protocolosOperacaoRouter.get("/execucoes/:chave/itens", async c => {
  try {
    const propriedadeId=await resolverEscopoEscrita(c);
    const f=paginaExecucaoSchema.parse({pagina:c.req.query("pagina"),porPagina:c.req.query("porPagina")});
    return c.json(await obterReciboExecucaoProtocolo(uuid.parse(c.req.param("chave")),propriedadeId,usuarioId(c),f));
  } catch(e) { return falha(c,e); }
});

protocolosOperacaoRouter.get("/tarefas/:id/insercoes",async c=>{try{const {propriedadeId:_sitio,...f}=c.req.query();return c.json(await listarInsercoesTarefa(uuid.parse(c.req.param("id")),await resolverEscopoEscrita(c),f));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.get("/tarefas/:id/servicos-manejo",async c=>{try{const {propriedadeId:_sitio,...f}=c.req.query();return c.json(await listarServicosManejo(uuid.parse(c.req.param("id")),await resolverEscopoEscrita(c),f));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.get("/manejos/:id",async c=>{try{return c.json(await obterManejoProtocolar(uuid.parse(c.req.param("id")),await resolverEscopoEscrita(c)));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.post("/manejos/:id/anulacao",async c=>{try{const i=anularManejoProtocoloSchema.parse(await c.req.json());return c.json(await anularManejoProtocolar(uuid.parse(c.req.param("id")),{...i,propriedadeId:await resolverEscopoEscrita(c,i.propriedadeId)},usuarioId(c)));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.post("/manejos/:id/correcao",async c=>{try{const i=corrigirManejoProtocoloSchema.parse(await c.req.json());if(i.item.valorServicoAtribuido!=null&&!podeVerValoresFinanceiros(getUsuario(c)??null))return c.json({error:"Permissão financeira para editar valores necessária",code:"SEM_PERMISSAO"},403);return c.json(await corrigirManejoProtocolar(uuid.parse(c.req.param("id")),{...i,propriedadeId:await resolverEscopoEscrita(c,i.propriedadeId)},usuarioId(c)));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.post("/tarefas/:id/regularizacao-manejo",async c=>{try{const i=regularizacaoSchema.parse(await c.req.json());return c.json(await regularizarManejoProtocolar(uuid.parse(c.req.param("id")),{...i,propriedadeId:await resolverEscopoEscrita(c,i.propriedadeId)},usuarioId(c)));}catch(e){return falha(c,e);}});

protocolosOperacaoRouter.get("/manejos",async c=>{try{const p=paginaExecucaoSchema.parse({pagina:c.req.query("pagina"),porPagina:c.req.query("porPagina")});return c.json(await listarManejosProtocolosAnimal(uuid.parse(c.req.query("animalId")),await resolverEscopoEscrita(c),p.pagina));}catch(e){return falha(c,e);}});

protocolosOperacaoRouter.get("/tarefas/:id/exames",async c=>{try{const {propriedadeId:_sitio,...f}=c.req.query();return c.json(await listarExamesTarefaClinica(uuid.parse(c.req.param("id")),await resolverEscopoLeitura(c),f));}catch(e){return falha(c,e);}});

protocolosOperacaoRouter.get("/tarefas/:id/aplicacoes-insercao",async c=>{try{const p=paginaExecucaoSchema.parse({pagina:c.req.query("pagina"),porPagina:c.req.query("porPagina")});return c.json(await listarAplicacoesReconhecerInsercao(uuid.parse(c.req.param("id")),await resolverEscopoEscrita(c),p.pagina));}catch(e){return falha(c,e);}});
protocolosOperacaoRouter.post("/tarefas/:id/reconhecer-insercao",async c=>{try{const i=reconhecerInsercaoSchema.parse(await c.req.json());return c.json(await reconhecerInsercaoDispositivo(uuid.parse(c.req.param("id")),{...i,propriedadeId:await resolverEscopoEscrita(c,i.propriedadeId)},usuarioId(c)));}catch(e){return falha(c,e);}});
