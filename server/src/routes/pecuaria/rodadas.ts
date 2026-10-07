import { Hono, type Context } from "hono";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { PropriedadeError, resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { consultaSanitariaSchema } from "../../services/pecuaria/sanidade/consulta.js";
import { ocultarCustosDetalhe } from "../../services/pecuaria/sanidade/detalhes.js";
import * as s from "../../services/pecuaria/sanidade/rodadas.js";
import { criarRodadaSchema, adicionarParticipantesSchema } from "../../services/pecuaria/sanidade/rodadas.schemas.js";
import { conflitoTransacaoPecuaria } from "../../services/pecuaria/transacao.js";
const uuid=z.string().uuid();
async function corpo(c:Context){const b=z.object({propriedadeId:z.number().int().positive().max(2147483647)}).passthrough().parse(await c.req.json());return {...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)};}
const autorizar=async(c:Context,next:()=>Promise<void>)=>{const u=getUsuario(c);if(!u||!temArea(u,"pecuaria"))return c.json({error:"Acesso à Pecuária necessário"},403);if(c.req.method!=="GET"&&!temPermissao(u,"lancar"))return c.json({error:"Permissão para lançar necessária"},403);await next();};
async function sitio(c:Context){const p=c.req.query("propriedadeId");return p?resolverEscopoEscrita(c,z.coerce.number().int().positive().max(2147483647).parse(p)):resolverEscopoLeitura(c);}
function resposta(c:Context,v:unknown){const u=getUsuario(c);return c.json(u&&temArea(u,"financeiro")&&temPermissao(u,"verValores")?v:ocultarCustosDetalhe(v));}
function falha(c:Context,e:unknown){if(e instanceof z.ZodError)return c.json({error:e.issues[0].message,code:"VALIDACAO",campo:e.issues[0].path.join(".")},422);if(e instanceof PropriedadeError)return c.json({error:e.message,code:e.code,campo:"propriedadeId"},422);if(e instanceof RebanhoError)return c.json({error:e.message,code:e.code,campo:e.campo},e.code==="NAO_ENCONTRADO"?404:e.code==="VALIDACAO"?422:409);if(conflitoTransacaoPecuaria(e)||(e&&typeof e==="object"&&"code" in e&&e.code==="P2002"))return c.json({error:"Os dados mudaram. Atualize a rodada e confira novamente.",code:"CONFLITO"},409);console.error("[rodadas]",e);return c.json({error:"Não foi possível consultar ou confirmar a rodada"},500);}
export const rodadasRouter=new Hono()
 .use("/rodadas",autorizar)
 .use("/rodadas/*",autorizar)
 .use("/execucoes-sem-rodada",autorizar)
 .get("/rodadas",async c=>{try{return resposta(c,await s.listarRodadas(await sitio(c),consultaSanitariaSchema.parse(c.req.query())));}catch(e){return falha(c,e);}})
 .get("/execucoes-sem-rodada",async c=>{try{return resposta(c,await s.listarSemRodada(await sitio(c),consultaSanitariaSchema.parse(c.req.query()),c.req.query("protocoloId")?uuid.parse(c.req.query("protocoloId")):undefined));}catch(e){return falha(c,e);}})
 .post("/rodadas/previa",async c=>{try{return resposta(c,await s.preverRodada(criarRodadaSchema.parse(await corpo(c))));}catch(e){return falha(c,e);}})
 .post("/rodadas",async c=>{try{return resposta(c,await s.criarRodada(criarRodadaSchema.parse(await corpo(c)),getUsuario(c)?.id??null));}catch(e){return falha(c,e);}})
 .get("/rodadas/:id",async c=>{try{return resposta(c,await s.obterRodada(uuid.parse(c.req.param("id")),await sitio(c)));}catch(e){return falha(c,e);}})
 .patch("/rodadas/:id",async c=>{try{return resposta(c,await s.renomearRodada(uuid.parse(c.req.param("id")),await corpo(c),getUsuario(c)?.id??null));}catch(e){return falha(c,e);}})
 .get("/rodadas/:id/participantes",async c=>{try{return resposta(c,await s.listarParticipantes(uuid.parse(c.req.param("id")),await sitio(c),consultaSanitariaSchema.parse(c.req.query())));}catch(e){return falha(c,e);}})
 .get("/rodadas/:id/etapas",async c=>{try{return resposta(c,await s.listarEtapas(uuid.parse(c.req.param("id")),await sitio(c),consultaSanitariaSchema.parse(c.req.query())));}catch(e){return falha(c,e);}})
 .get("/rodadas/:id/etapas/:etapaId/tarefas",async c=>{try{return resposta(c,await s.listarTarefasEtapa(uuid.parse(c.req.param("id")),uuid.parse(c.req.param("etapaId")),await sitio(c),consultaSanitariaSchema.parse(c.req.query())));}catch(e){return falha(c,e);}})
 .post("/rodadas/:id/participantes/previa",async c=>{try{const b=adicionarParticipantesSchema.parse(await corpo(c));const id=uuid.parse(c.req.param("id"));const r=await s.obterRodada(id,b.propriedadeId);return resposta(c,await s.preverRodada({...b,nome:r.nome,protocoloId:r.protocoloId,inicioReferencia:r.inicioReferencia.toISOString().slice(0,10)},id));}catch(e){return falha(c,e);}})
 .post("/rodadas/:id/participantes",async c=>{try{return resposta(c,await s.adicionarParticipantes(uuid.parse(c.req.param("id")),await corpo(c),getUsuario(c)?.id??null));}catch(e){return falha(c,e);}})
 .post("/rodadas/:id/associacao",async c=>{try{return resposta(c,await s.associarExecucoes(uuid.parse(c.req.param("id")),await corpo(c),getUsuario(c)?.id??null));}catch(e){return falha(c,e);}})
 .post("/rodadas/:id/participantes/:execucaoId/remocao",async c=>{try{return resposta(c,await s.retirarParticipante(uuid.parse(c.req.param("id")),uuid.parse(c.req.param("execucaoId")),await corpo(c),getUsuario(c)?.id??null));}catch(e){return falha(c,e);}});
