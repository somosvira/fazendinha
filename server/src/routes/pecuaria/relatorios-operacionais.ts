import {Hono} from 'hono';
import {z} from 'zod';
import {exigeArea,getUsuario} from '../../middleware/permissao.js';
import {resolverEscopoLeitura} from '../../services/propriedade.js';
import {podeConsultarCustosPecuaria,podeVerValoresFinanceiros} from '../../services/pecuaria/custos/permissoes.js';
import {consultarRelatoriosRebanho} from '../../services/pecuaria/relatorios/rebanho.js';
import {consultarRelatoriosSanidadeLeite} from '../../services/pecuaria/relatorios/sanidade-leite.js';
import {consultarRelatoriosNutricaoCustos} from '../../services/pecuaria/relatorios/nutricao-custos.js';
import {buscarAnimaisHistoricosRelatorio} from '../../services/pecuaria/relatorios/animais-historicos.js';
import {falhaV4} from './reproducao.js';
import {consultarRelatoriosAnteriores} from '../../services/pecuaria/relatorios/anteriores.js';
import {consultarRelatorioFiltrado} from '../../services/pecuaria/relatorios/consulta-filtrada.js';
import {camposFiltroRelatorio,filtrosRelatorioSchema,ErroFiltroRelatorio} from '../../services/pecuaria/relatorios/filtros.js';
const listaCsv=(v:unknown)=>typeof v==='string'?v.split(','):v;
const filtrosJson=z.string().max(30000).transform((v,ctx)=>{try{return JSON.parse(v) as unknown;}catch{ctx.addIssue({code:'custom',message:'Filtros devem ser um JSON válido.'});return z.NEVER;}}).pipe(filtrosRelatorioSchema);
export const consultaRelatorioOperacionalSchema=z.object({fonte:z.string().min(1).max(40),propriedadeId:z.coerce.number().int().positive().optional(),inicio:z.string().date(),fim:z.string().date(),pagina:z.coerce.number().int().min(1).max(1000000).default(1),porPagina:z.coerce.number().int().min(1).max(100).default(12),animalId:z.string().uuid().optional(),loteId:z.string().uuid().optional(),filtros:filtrosJson.optional(),corte:z.string().date().optional(),tiposTentativa:z.preprocess(listaCsv,z.array(z.enum(['IA','TE','COBERTURA'])).min(1).max(3)).optional(),papeis:z.preprocess(listaCsv,z.array(z.enum(['NENHUM','DOADORA','RECEPTORA'])).min(1).max(3)).optional(),deslocamentoTeDias:z.coerce.number().int().min(0).max(30).optional(),concepcaoEstimada:z.coerce.number().min(0).max(100).optional(),janelaPerdaDias:z.coerce.number().int().min(1).max(1000).optional(),iepModo:z.enum(['VIVOS_NATIMORTOS','TODOS_PARTOS']).optional()}).superRefine((q,ctx)=>{
 if(q.inicio>q.fim)ctx.addIssue({code:'custom',message:'O início deve ser anterior ou igual ao fim.',path:['fim']});
 if(q.corte&&q.corte<q.fim)ctx.addIssue({code:'custom',message:'O corte deve ser igual ou posterior ao fim.',path:['corte']});
 for(const campo of ['tiposTentativa','papeis'] as const)if(q[campo]&&new Set(q[campo]).size!==q[campo]!.length)ctx.addIssue({code:'custom',message:'Não repita opções de população.',path:[campo]});
 const motores=['indicadores','iep','perdas','espera','concepcoes'];
 const fontesPorParametro={corte:motores,papeis:motores,tiposTentativa:['indicadores','espera','concepcoes','tentativas'],janelaPerdaDias:['perdas'],iepModo:['iep'],deslocamentoTeDias:['indicadores'],concepcaoEstimada:['indicadores']} as const;
 for(const campo of Object.keys(fontesPorParametro) as (keyof typeof fontesPorParametro)[])if(q[campo]!==undefined&&!(fontesPorParametro[campo] as readonly string[]).includes(q.fonte))ctx.addIssue({code:'custom',message:`O parâmetro ${campo} não está disponível nesta fonte.`,path:[campo]});

});
export const relatoriosOperacionaisRouter=new Hono().use('*',exigeArea('pecuaria')).get('/consulta',async c=>{
 const entrada=consultaRelatorioOperacionalSchema.safeParse(c.req.query());
 if(!entrada.success)return c.json({error:entrada.error.issues[0].message,code:'VALIDACAO'},422);
 try{
  const propriedadeId=await resolverEscopoLeitura(c);
  if(propriedadeId==null)return c.json({error:'Selecione um sítio para consultar o relatório.',code:'VALIDACAO'},422);
  if(entrada.data.propriedadeId!=null&&entrada.data.propriedadeId!==propriedadeId)return c.json({error:'O sítio da consulta não corresponde ao escopo autorizado.',code:'SEM_PERMISSAO'},403);
  const usuario=getUsuario(c),q={...entrada.data,propriedadeId,podeVerValores:podeVerValoresFinanceiros(usuario),podeConsultarCustos:podeConsultarCustosPecuaria(usuario)};
  if(q.fonte==='custos'&&!q.podeConsultarCustos)return c.json({error:'Sem permissão para consultar custos diretos.'},403);
  const r=await consultarRelatorioFiltrado(q,[consultarRelatoriosRebanho,consultarRelatoriosSanidadeLeite,consultarRelatoriosNutricaoCustos,consultarRelatoriosAnteriores]);
  if(r)return c.json({...r,propriedadeId});
  return c.json({error:'Fonte de relatório desconhecida.',code:'VALIDACAO'},422);
 }catch(e){if(e instanceof ErroFiltroRelatorio)return c.json({error:e.message,code:e.status===403?'SEM_PERMISSAO':'VALIDACAO'},e.status);return falhaV4(c,e)}
});


const camposConsultaSchema=z.object({fonte:z.string().min(1).max(40),propriedadeId:z.coerce.number().int().positive().optional()});
relatoriosOperacionaisRouter.get('/filtros',async c=>{
 const entrada=camposConsultaSchema.safeParse(c.req.query());
 if(!entrada.success)return c.json({error:'Fonte ou sítio inválido.',code:'VALIDACAO'},422);
 try{
  const propriedadeId=await resolverEscopoLeitura(c);
  if(propriedadeId==null)return c.json({error:'Selecione um sítio para consultar filtros.',code:'VALIDACAO'},422);
  if(entrada.data.propriedadeId!=null&&entrada.data.propriedadeId!==propriedadeId)return c.json({error:'O sítio da consulta não corresponde ao escopo autorizado.',code:'SEM_PERMISSAO'},403);
  const usuario=getUsuario(c);
  if(entrada.data.fonte==='custos'&&!podeConsultarCustosPecuaria(usuario))return c.json({error:'Sem permissão para consultar custos diretos.'},403);
  return c.json({campos:camposFiltroRelatorio(entrada.data.fonte,podeVerValoresFinanceiros(usuario)),populacao:['indicadores','iep','perdas','espera','concepcoes'].includes(entrada.data.fonte)});
 }catch(e){if(e instanceof ErroFiltroRelatorio)return c.json({error:e.message,code:'VALIDACAO'},e.status);return falhaV4(c,e)}
});

const buscaAnimalHistoricoSchema=z.object({propriedadeId:z.coerce.number().int().positive().max(2147483647).optional(),busca:z.string().trim().max(100).default('')});
relatoriosOperacionaisRouter.get('/animais-historicos',async c=>{
 const entrada=buscaAnimalHistoricoSchema.safeParse(c.req.query());
 if(!entrada.success)return c.json({error:entrada.error.issues[0].message,code:'VALIDACAO'},422);
 try{
  const propriedadeId=await resolverEscopoLeitura(c);
  if(propriedadeId==null)return c.json({error:'Selecione um sítio para buscar animais.',code:'VALIDACAO'},422);
  if(entrada.data.propriedadeId!=null&&entrada.data.propriedadeId!==propriedadeId)return c.json({error:'O sítio da busca não corresponde ao escopo autorizado.',code:'SEM_PERMISSAO'},403);
  return c.json({propriedadeId,itens:await buscarAnimaisHistoricosRelatorio(propriedadeId,entrada.data.busca)});
 }catch(e){return falhaV4(c,e)}
});
