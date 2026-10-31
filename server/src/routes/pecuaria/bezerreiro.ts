import { ValorizacaoError } from '../../services/estoque/valorizacao.calc.js';
import { FinanceiroError } from '../../services/financeiro/regras.js';
import { EstoqueError } from '../../services/estoque/estoque.js';
import { Hono, type Context } from 'hono';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { exigeArea, exigePermissao, getUsuario } from '../../middleware/permissao.js';
import { resolverEscopoEscrita, resolverEscopoLeitura, PropriedadeError } from '../../services/propriedade.js';
import { podeVerValoresFinanceiros } from '../../services/pecuaria/custos/permissoes.js';
import { RebanhoError } from '../../services/pecuaria/rebanho/regras.js';
import * as schemas from '../../services/pecuaria/bezerreiro/schemas.js';
import * as gestao from '../../services/pecuaria/bezerreiro/gestao.js';
import * as aleitamento from '../../services/pecuaria/bezerreiro/aleitamento.js';
import * as consultas from '../../services/pecuaria/bezerreiro/consultas.js';
import * as colostro from '../../services/pecuaria/bezerreiro/colostro.js';
import * as cs from '../../services/pecuaria/bezerreiro/colostro.schemas.js';
const id=(c:Context)=>z.string().uuid().parse(c.req.param('id'));
const autor=(c:Context)=>{const a=getUsuario(c)?.id;return a&&a>0?a:null};
const valores=(c:Context)=>podeVerValoresFinanceiros(getUsuario(c));
async function sitio(c:Context){const p=await resolverEscopoLeitura(c);if(p==null)throw new RebanhoError('VALIDACAO','Selecione um sítio para consultar o bezerreiro');return p;}
function falha(c:Context,e:unknown){
 if(e instanceof ValorizacaoError||e instanceof FinanceiroError||e instanceof EstoqueError)return c.json({error:e.message,code:e.code},e.code==='VALIDACAO'?422:e.code==='NAO_ENCONTRADO'?404:409);
 if(e instanceof z.ZodError)return c.json({error:e.issues[0].message,code:'VALIDACAO'},422);
 if(e instanceof RebanhoError)return c.json({error:e.message,code:e.code,campo:e.campo},e.code==='NAO_ENCONTRADO'?404:e.code==='VALIDACAO'?422:409);
 if(e instanceof PropriedadeError)return c.json({error:e.message,code:e.code},422);
 if(e instanceof Prisma.PrismaClientKnownRequestError){if(['P2002','P2025','P2034','P2004'].includes(e.code))return c.json({error:'O registro mudou ou conflita com outro fato. Atualize a consulta.',code:'CONFLITO'},409);if(e.code==='P2021'||e.code==='P2022')return c.json({error:'A atualização do banco para o Bezerreiro ainda não foi aplicada neste ambiente.',code:'MIGRACAO_PENDENTE'},409);}
 console.error('[pecuaria/bezerreiro]',e);return c.json({error:'Não foi possível processar o bezerreiro. Tente novamente.'},500);
}
function ler(fn:(c:Context,propriedadeId:number)=>Promise<unknown>){return async(c:Context)=>{try{return c.json(await fn(c,await sitio(c)))}catch(e){return falha(c,e)}};}
function escrever<S extends z.ZodTypeAny>(schema:S,fn:(c:Context,input:z.output<S>&{propriedadeId:number},usuarioId:number|null)=>Promise<unknown>){return async(c:Context)=>{try{const dados=schema.parse(await c.req.json());return c.json(await fn(c,{...dados,propriedadeId:await resolverEscopoEscrita(c,dados.propriedadeId)},autor(c)),201)}catch(e){return falha(c,e)}};}
const q=(c:Context)=>schemas.consultaSchema.parse(c.req.query());
function cq(c:Context){const raw=c.req.query();return cs.consultaColostroSchema.parse({pagina:raw.pagina,tamanho:raw.tamanho??raw.porPagina,partoId:raw.partoId,matrizId:raw.matrizId,criaId:raw.criaId,inicio:raw.inicio??raw.de,fim:raw.fim??raw.ate,tipo:raw.tipo,incluirEstornados:raw.incluirEstornados==='true'});}
const consultaPartosColostroSchema=z.object({data:schemas.dataCivil,busca:z.string().trim().max(100).optional(),pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(100).default(20),partoId:z.string().uuid().optional(),criaId:z.string().uuid().optional(),alvo:z.enum(['MATRIZ','CRIA']).default('MATRIZ')});
const consultaFornecimentosColostroSchema=z.object({criaId:z.string().uuid(),fornecimentoId:z.string().uuid().optional(),data:schemas.dataCivil,pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(100).default(20)});
const vinculoSchema=schemas.comando.extend({animalId:z.string().uuid(),exameId:z.string().uuid(),metodo:z.string().max(160).optional(),material:z.string().max(160).optional(),instrumento:z.string().max(160).optional(),laboratorio:z.string().max(160).optional(),ocorridoEm:z.string().datetime({offset:true}).nullish()});
export const bezerreiroRouter=new Hono().use('*',exigeArea('pecuaria'))
.get('/insumos/:id/partidas',ler((c,p)=>consultas.consultarPartidasInsumo(id(c),p,q(c).data)))
.get('/contexto',ler((c,p)=>consultas.consultarContexto(p,q(c))))
.get('/configuracoes',ler((_c,p)=>gestao.consultarConfiguracao(p)))
.post('/configuracoes',exigePermissao('lancar'),escrever(schemas.salvarConfiguracaoSchema,(_c,d,a)=>gestao.salvarConfiguracao(d,a)))
.post('/perfis',exigePermissao('lancar'),escrever(schemas.perfilSchema,(_c,d,a)=>gestao.registrarPerfil(d,a)))
.get('/participantes',ler((c,p)=>gestao.listarParticipantes(p,q(c))))
.post('/participantes',exigePermissao('lancar'),escrever(schemas.participacaoSchema,(_c,d,a)=>gestao.registrarParticipacao(d,a)))
.post('/participantes/:id/fase',exigePermissao('lancar'),escrever(schemas.mudarFaseSchema,(c,d,a)=>gestao.mudarFase(id(c),d,a)))
.post('/participantes/:id/saida',exigePermissao('lancar'),escrever(schemas.sairSchema,(c,d,a)=>gestao.sairParticipacao(id(c),d,a)))
.get('/previsao',ler((c,p)=>aleitamento.consultarPrevisao(p,q(c))))
.get('/ofertas',ler((c,p)=>aleitamento.consultarOfertas(p,q(c),valores(c))))
.post('/ofertas',exigePermissao('lancar'),escrever(schemas.confirmarOfertaSchema,(_c,d,a)=>aleitamento.confirmarOferta(d,a)))
.post('/ofertas/:id/estorno',exigePermissao('lancar'),escrever(schemas.estornoSchema,(c,d,a)=>aleitamento.estornarOferta(id(c),d,a)))
.get('/custos',ler((c,p)=>consultas.consultarCustosBezerreiro(p,q(c),valores(c))))
.get('/sanidade',ler((c,p)=>consultas.consultarSanidade(p,q(c))))
.get('/animais/:id/acompanhamento',ler((c,p)=>consultas.consultarAcompanhamento(id(c),p)))
.post('/vinculos-exame',exigePermissao('lancar'),escrever(vinculoSchema,(_c,d,a)=>consultas.vincularExame(d,a)))
.get('/colostro/partos',ler((c,p)=>consultas.consultarPartosColostro(p,consultaPartosColostroSchema.parse(c.req.query()))))
.get('/colostro/fornecimentos',ler((c,p)=>colostro.listarFornecimentosColostro(p,consultaFornecimentosColostroSchema.parse(c.req.query()))))
.get('/colostro/unidades',ler((c,p)=>consultas.consultarUnidadesColostro(p,q(c))))
.get('/colostro/producoes',ler((c,p)=>{const input=z.object({partoId:z.string().uuid(),data:schemas.dataCivil}).parse(c.req.query());return colostro.listarProducoesRetiradaColostro(p,input)}))
.get('/colostro/retiradas',ler((c,p)=>colostro.listarRetiradasColostro(p,cq(c))))
.post('/colostro/retiradas',exigePermissao('lancar'),escrever(cs.retiradaColostroSchema,(_c,d,a)=>colostro.registrarRetiradaColostro(d,a)))
.post('/colostro/retiradas/:id/confirmacao',exigePermissao('lancar'),escrever(cs.confirmarRetiradaColostroSchema,(c,d,a)=>colostro.confirmarRetiradaColostro(id(c),d,a)))
.post('/colostro/retiradas/:id/estorno',exigePermissao('lancar'),escrever(cs.estornoColostroSchema,(c,d,a)=>colostro.estornarRetiradaColostro(id(c),d,a)))
.get('/colostro/origens',ler((c,p)=>colostro.listarOrigensColostro(p,cq(c),{verValores:valores(c)})))
.get('/colostro/origens/:id',ler((c,p)=>colostro.consultarOrigemColostro(id(c),p,{verValores:valores(c)})))
.post('/colostro/origens/:id/brix',exigePermissao('lancar'),escrever(cs.brixColostroSchema,(c,d,a)=>colostro.registrarBrixColostro(id(c),d,a)))
.post('/colostro/origens/:id/destinacoes',exigePermissao('lancar'),escrever(cs.destinacaoColostroSchema,(c,d,a)=>colostro.destinarColostro(id(c),d,a,{verValores:valores(c)})))
.get('/colostro/destinacoes',ler((c,p)=>colostro.listarHistoricoColostro(p,cq(c),'destinacoes')))
.get('/colostro/destinacoes/:id',ler((c,p)=>colostro.consultarDestinacaoColostro(id(c),p,{verValores:valores(c)})))
.post('/colostro/destinacoes/:id/estorno',exigePermissao('lancar'),escrever(cs.estornoColostroSchema,(c,d,a)=>colostro.estornarDestinacaoColostro(id(c),d,a,{verValores:valores(c)})))
.get('/colostro/enriquecimentos',ler((c,p)=>colostro.listarHistoricoColostro(p,cq(c),'enriquecimentos')))
.post('/colostro/enriquecimentos',exigePermissao('lancar'),escrever(cs.enriquecimentoColostroSchema,(c,d,a)=>colostro.enriquecerColostro(d,a,{verValores:valores(c)})))
.get('/colostro/enriquecimentos/:id',ler((c,p)=>colostro.consultarPreparoColostro(id(c),p,{verValores:valores(c)})))
.post('/colostro/enriquecimentos/:id/estorno',exigePermissao('lancar'),escrever(cs.estornoColostroSchema,(c,d,a)=>colostro.estornarPreparoColostro(id(c),d,a,{verValores:valores(c)})));
