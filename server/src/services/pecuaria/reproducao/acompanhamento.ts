import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
import { proporAcompanhamentos, identidadeDemandaAcompanhamento } from "./acompanhamento.calc.js";
import { parametrosAcompanhamentoSchema, type CriarPoliticaAcompanhamentoInput, type PreviaAdocaoAcompanhamentoInput, type AdotarAcompanhamentoInput } from "./acompanhamento.schemas.js";

const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const texto=(d:Date)=>d.toISOString().slice(0,10);
const json=(v:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(v));
function erro(message:string,campo?:string):never{throw new RebanhoError("VALIDACAO",message,campo);}

export async function vincularExameDemandaTx(tx:Prisma.TransactionClient,demandaId:string,exameId:string){
 const [demanda,exame]=await Promise.all([tx.demandaAcompanhamentoReprodutivo.findUnique({where:{id:demandaId}}),tx.exameAnimal.findUnique({where:{id:exameId},include:{interpretacao:true}})]);
 if(!demanda||!exame||demanda.estado!=="PENDENTE"||demanda.animalId!==exame.animalId)erro("Demanda não está pendente para este animal", "demandaAcompanhamentoId");
 const regra=demanda.regraSnapshot as Record<string,unknown>;
 const formato=exame.formatoSnapshot as Record<string,unknown>;
 if(!exame.finalidades.includes(demanda.finalidade)||(demanda.tentativaId?exame.interpretacao?.tentativaId!==demanda.tentativaId:exame.interpretacao?.gestacaoId!==demanda.gestacaoId)||exame.data<demanda.dataReferencia)erro("Exame não corresponde à origem e finalidade da demanda", "demandaAcompanhamentoId");
 if(regra.tipoExameId&&(regra.tipoExameId!==exame.tipoExameId||regra.tipoExameVersao!==formato.versao))erro("Tipo ou versão de exame difere da regra congelada", "tipoExameId");
 await tx.exameAnimal.update({where:{id:exameId},data:{demandaAcompanhamentoId:demandaId}});
}

export function listarPoliticasAcompanhamento(propriedadeId:number){return prisma.politicaAcompanhamentoReprodutivo.findMany({where:{propriedadeId},orderBy:{versao:"desc"}});}
export function criarPoliticaAcompanhamento(input:CriarPoliticaAcompanhamentoInput,usuarioId:number|null){
 return transacaoPecuaria(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-politica-acompanhamento:${input.propriedadeId}`}))`;
  return operacaoIdempotenteTx(tx,input,usuarioId,"POLITICA_ACOMPANHAMENTO",async()=>{
   const parametros=parametrosAcompanhamentoSchema.parse(input.parametros);
   for(const regra of [...(parametros.diagnostico?[parametros.diagnostico]:[]),...parametros.reconfirmacoes])if(regra.tipoExameId){
    const tipo=await tx.tipoExame.findUnique({where:{id:regra.tipoExameId}});
    if(!tipo||!tipo.ativo||tipo.contexto==="SANITARIO"||tipo.tipoResultado!=="MULTIPLO")erro("Selecione um tipo de exame reprodutivo ativo", "tipoExameId");
    if(regra.tipoExameVersao&&regra.tipoExameVersao!==tipo.versaoFormato)throw new RebanhoError("CONFLITO","A versão do tipo de exame mudou; confira a política");
    regra.tipoExameVersao=tipo.versaoFormato;
   }
   const anterior=await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{propriedadeId:input.propriedadeId},orderBy:{versao:"desc"}});
   if(anterior&&dia(input.vigenteDesde)<=anterior.vigenteDesde)erro("Nova vigência deve ser posterior à última versão; demandas existentes conservam a regra", "vigenteDesde");
   const criada=await tx.politicaAcompanhamentoReprodutivo.create({data:{propriedadeId:input.propriedadeId,versao:(anterior?.versao??0)+1,vigenteDesde:dia(input.vigenteDesde),parametros:json(parametros),criadoPorId:usuarioId}});
   await auditar(tx,{entidade:"PoliticaAcompanhamentoReprodutivo",entidadeId:criada.id,propriedadeId:input.propriedadeId,acao:"REGISTRO",usuarioId,depois:criada});
   return criada;
  });
 });
}

type Origem={tentativaId?:string;gestacaoId?:string;animalId:string;propriedadeId:number;data:Date;exameOrigemId?:string};
async function propostasTx(tx:Prisma.TransactionClient,origem:Origem,politicaId?:string){
 const politica=await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{propriedadeId:origem.propriedadeId,...(politicaId?{id:politicaId}:{vigenteDesde:{lte:origem.data}})},orderBy:{vigenteDesde:"desc"}});
 if(!politica){if(politicaId)erro("Política não pertence ao sítio de origem", "politicaId");return [];}
 return proporAcompanhamentos({...politica,parametros:parametrosAcompanhamentoSchema.parse(politica.parametros)},{...origem,data:texto(origem.data)}).map(p=>({...p,politicaId:politica.id}));
}
/** Somente escritores chamam esta função. Uma leitura nunca adota políticas em fatos antigos. */
export async function criarDemandasDoFatoTx(tx:Prisma.TransactionClient,origem:Origem,usuarioId:number|null,politicaId?:string){
 const propostas=await propostasTx(tx,origem,politicaId);
 for(const p of propostas){
  const existente=await tx.demandaAcompanhamentoReprodutivo.findFirst({where:{tentativaId:p.tentativaId,gestacaoId:p.gestacaoId,finalidade:p.finalidade,ocorrencia:p.ocorrencia}});
  if(existente)continue;
  const criada=await tx.demandaAcompanhamentoReprodutivo.create({data:{animalId:origem.animalId,propriedadeOrigemId:origem.propriedadeId,politicaId:p.politicaId,finalidade:p.finalidade,ocorrencia:p.ocorrencia,tentativaId:p.tentativaId,gestacaoId:p.gestacaoId,dataReferencia:dia(p.dataReferencia),previstaPara:dia(p.previstaPara),regraSnapshot:json(p.regraSnapshot),origemAdocao:politicaId?"ADOCAO_EXPLICITA":"FATO_NOVO",exameOrigemId:origem.exameOrigemId,criadoPorId:usuarioId}});
  await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:criada.id,animalId:origem.animalId,propriedadeId:origem.propriedadeId,acao:politicaId?"ADOCAO_EXPLICITA":"REGISTRO",usuarioId,depois:criada});
 }
}

/** Reavalia apenas demandas já criadas, inclusive quando uma evidência é anulada. Não aplica uma política nova. */
export async function reconciliarDemandasAnimalTx(tx:Prisma.TransactionClient,animalId:string,usuarioId:number|null){
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId},include:{tentativa:{include:{tarefa:true}},gestacao:true},orderBy:[{previstaPara:"asc"},{ocorrencia:"asc"},{id:"asc"}]});
 if(!demandas.length)return;
 const exames=await tx.exameAnimal.findMany({where:{animalId,status:"VALIDO",realizacao:"REALIZADO"},include:{interpretacao:true,resultados:{where:{vigente:true,campo:"CONCLUSAO_GESTACIONAL"}}},orderBy:[{data:"asc"},{criadoEm:"asc"},{id:"asc"}]});
 const partos=await tx.partoAnimal.findMany({where:{animalId,status:"VALIDO"},orderBy:[{data:"asc"},{id:"asc"}]});
 const tentativas=await tx.tentativaReprodutiva.findMany({where:{animalId,status:"VALIDO"},include:{tarefa:true},orderBy:[{data:"asc"},{ordem:"asc"}]});
 const utilizados=new Set<string>();
 const tarefasReservadas=new Set(demandas.flatMap(d=>d.tarefaId?[d.tarefaId]:[]));
 const alteracoes:Array<{antes:(typeof demandas)[number];dados:Prisma.DemandaAcompanhamentoReprodutivoUncheckedUpdateInput}>=[];
 for(const d of demandas){
  const regra=d.regraSnapshot as Record<string,unknown>;
  let tarefaId=d.tarefaId;
  const tarefaOrigem=d.tentativa?.tarefa??tentativas.find(t=>t.id===d.gestacao?.tentativaId)?.tarefa;
  if(!d.tarefaId&&tarefaOrigem){
   const tarefas=await tx.tarefaProtocolo.findMany({where:{execucaoId:tarefaOrigem.execucaoId,demandaAcompanhamento:null,dispensadaEm:null,realizadaEm:null,regularizacaoPendente:false},include:{etapa:true},orderBy:[{previstaPara:"asc"},{id:"asc"}]});
   const compativel=tarefas.find(t=>{
    const config=t.etapa.configuracao as Record<string,unknown>;
    const plano=config.planoAvaliacao as {tipo?:string;tipoExameId?:string}|undefined;
    const refs=config.referencias as {exame?:{versao?:number}}|undefined;
    return !tarefasReservadas.has(t.id)&&(!regra.tipoExameVersao||refs?.exame?.versao===regra.tipoExameVersao)&&config.tipo==="AVALIACAO"&&plano?.tipo===d.finalidade&&(!regra.tipoExameId||plano.tipoExameId===regra.tipoExameId)&&t.previstaPara>=d.dataReferencia;
   });
   if(compativel){tarefaId=compativel.id;tarefasReservadas.add(compativel.id);}
  }
  const fonte=d.tentativa??d.gestacao;
  const parto=partos.find(p=>p.data>=d.dataReferencia&&(!d.gestacaoId||p.gestacaoId===d.gestacaoId));
  const substituta=d.tentativa?tentativas.find(t=>t.data>d.tentativa!.data||(t.data.getTime()===d.tentativa!.data.getTime()&&t.ordem>d.tentativa!.ordem)):null;
  const fim=[d.gestacao?.encerradaEm,parto?.data,substituta?.data].filter((data):data is Date=>!!data).sort((a,b)=>a.getTime()-b.getTime())[0]??null;
  const evidencia=exames.find(e=>{
   const i=e.interpretacao;
   if(!i||(e.demandaAcompanhamentoId&&e.demandaAcompanhamentoId!==d.id)||utilizados.has(e.id)||e.data<d.dataReferencia||(fim&&e.data>fim)||!e.finalidades.includes(d.finalidade))return false;
   if(d.tentativaId?i.tentativaId!==d.tentativaId:i.gestacaoId!==d.gestacaoId)return false;
   if(d.finalidade==="RECONFIRMACAO"&&e.data<d.previstaPara)return false;
   const formato=e.formatoSnapshot as Record<string,unknown>;
   if(regra.tipoExameId&&(e.tipoExameId!==regra.tipoExameId||formato.versao!==regra.tipoExameVersao))return false;
   return e.resultados.some(r=>typeof r.valor==="string"&&["POSITIVO","NEGATIVO"].includes(r.valor));
  });
  const conclusivo=evidencia;
  let dados:Prisma.DemandaAcompanhamentoReprodutivoUncheckedUpdateInput;
  if(conclusivo&&fonte?.status==="VALIDO"){
   utilizados.add(conclusivo.id);
   dados={estado:"RESOLVIDA",exameResolucaoId:conclusivo.id,resolvidaEm:conclusivo.data,resolucaoSnapshot:json({exameId:conclusivo.id,data:texto(conclusivo.data),formato:conclusivo.formatoSnapshot}),encerradaEm:null,motivoEncerramento:null};
  }else if(fonte?.status!=="VALIDO"||fim){
   const motivo=fonte?.status!=="VALIDO"?"ORIGEM_ANULADA":d.gestacao?.encerradaEm?`GESTACAO_ENCERRADA_${d.gestacao.tipoEncerramento??"NAO_IDENTIFICADO"}`:parto?"CICLO_ENCERRADO_POR_PARTO":"TENTATIVA_SUBSTITUIDA";
   dados={estado:"ENCERRADA",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:Prisma.DbNull,encerradaEm:fim??new Date(),motivoEncerramento:motivo};
  }else dados={estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:Prisma.DbNull,encerradaEm:null,motivoEncerramento:null};
  dados.tarefaId=tarefaId;
  if(d.tarefaId===tarefaId&&d.estado===dados.estado&&d.exameResolucaoId===(dados.exameResolucaoId??null)&&d.motivoEncerramento===(dados.motivoEncerramento??null))continue;
  alteracoes.push({antes:d,dados});
 }
 // A unicidade de exame resolvedor é imediata. Libere a atribuição antiga antes de realocar provas.
 for(const {antes,dados} of alteracoes)if(antes.exameResolucaoId&&antes.exameResolucaoId!==dados.exameResolucaoId)await tx.demandaAcompanhamentoReprodutivo.update({where:{id:antes.id},data:{estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:Prisma.DbNull}});
 for(const {antes,dados} of alteracoes){
  const salva=await tx.demandaAcompanhamentoReprodutivo.update({where:{id:antes.id},data:{...dados,versao:{increment:1}}});
  await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:antes.id,animalId,propriedadeId:antes.propriedadeOrigemId,acao:"RECONCILIACAO",usuarioId,antes,depois:salva});
 }
}
async function previaAdocaoTx(tx:Prisma.TransactionClient,input:PreviaAdocaoAcompanhamentoInput){
 const [tentativas,gestacoes]=await Promise.all([tx.tentativaReprodutiva.findMany({where:{id:{in:input.tentativaIds},status:"VALIDO",propriedadeId:input.propriedadeId},orderBy:{id:"asc"}}),tx.gestacaoAnimal.findMany({where:{id:{in:input.gestacaoIds},status:"VALIDO",propriedadeId:input.propriedadeId,encerradaEm:null},orderBy:{id:"asc"}})]);
 if(tentativas.length!==input.tentativaIds.length||gestacoes.length!==input.gestacaoIds.length)erro("Fatos válidos não pertencem ao sítio escolhido; gestações devem estar abertas");
 const origens:Origem[]=tentativas.map(t=>({tentativaId:t.id,animalId:t.animalId,propriedadeId:input.propriedadeId,data:t.data}));
 for(const g of gestacoes){
  const primeiro=await tx.exameAnimal.findFirst({where:{animalId:g.animalId,status:"VALIDO",realizacao:"REALIZADO",interpretacao:{gestacaoId:g.id},resultados:{some:{campo:"CONCLUSAO_GESTACIONAL",vigente:true,valor:{equals:"POSITIVO"}}}},orderBy:[{data:"asc"},{id:"asc"}]});
  if(!primeiro)erro("Gestação sem primeiro DG positivo comprovado; reconcilie a evidência antes de adotar reconfirmações", "gestacaoIds");
  origens.push({gestacaoId:g.id,animalId:g.animalId,propriedadeId:input.propriedadeId,data:primeiro.data,exameOrigemId:primeiro.id});
 }
 const propostas=[];
 for(const origem of origens)for(const p of await propostasTx(tx,origem,input.politicaId)){
  const existente=await tx.demandaAcompanhamentoReprodutivo.findFirst({where:{tentativaId:p.tentativaId,gestacaoId:p.gestacaoId,finalidade:p.finalidade,ocorrencia:p.ocorrencia}});
  propostas.push({...p,animalId:origem.animalId,identidade:identidadeDemandaAcompanhamento(p),existenteId:existente?.id??null,acao:existente?"PRESERVAR_REGRA_CONGELADA":"CRIAR"});
 }
 return {origens,propostas,revisao:hashDados({origens,propostas})};
}
export function previaAdocaoAcompanhamento(input:PreviaAdocaoAcompanhamentoInput){return prisma.$transaction(tx=>previaAdocaoTx(tx,input));}
export function adotarAcompanhamento(input:AdotarAcompanhamentoInput,usuarioId:number|null){return transacaoPecuaria(async tx=>{
 const previa=await previaAdocaoTx(tx,input);
 await travarAnimais(tx,previa.origens.map(o=>o.animalId));
 return operacaoIdempotenteTx(tx,input,usuarioId,"ADOCAO_ACOMPANHAMENTO",async()=>{
  const atual=await previaAdocaoTx(tx,input);
  if(atual.revisao!==input.revisao)throw new RebanhoError("CONFLITO","Os fatos ou as demandas mudaram; confira novamente a adoção");
  for(const origem of atual.origens){await criarDemandasDoFatoTx(tx,origem,usuarioId,input.politicaId);await reconciliarDemandasAnimalTx(tx,origem.animalId,usuarioId);}
  await auditar(tx,{entidade:"PoliticaAcompanhamentoReprodutivo",entidadeId:input.politicaId,propriedadeId:input.propriedadeId,acao:"ADOCAO_EXPLICITA",usuarioId,depois:{motivo:input.motivo,revisao:input.revisao,propostas:atual.propostas}});
  return {propostas:atual.propostas};
 });
});}
export async function listarAcompanhamentos(propriedadeId:number,animalId:string|undefined,data:string){
 return prisma.$transaction(async tx=>{
  if(animalId)await conferirAnimalNoFato(tx,animalId,propriedadeId,dia(data));
  const locais=animalId?[{animalId}]:await tx.localizacaoAnimal.findMany({where:{propriedadeId,desde:{lte:dia(data)},OR:[{ate:null},{ate:{gt:dia(data)}}]},select:{animalId:true}});
  return tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:{in:locais.map(l=>l.animalId)},dataReferencia:{lte:dia(data)}},orderBy:[{previstaPara:"asc"},{id:"asc"}]});
 });
}
