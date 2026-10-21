import { Prisma, type DemandaAcompanhamentoReprodutivo } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
import { proporAcompanhamentos, identidadeDemandaAcompanhamento } from "./acompanhamento.calc.js";
import { consultaAcompanhamentoSchema, parametrosAcompanhamentoSchema, type CriarPoliticaAcompanhamentoInput, type PreviaAdocaoAcompanhamentoInput, type AdotarAcompanhamentoInput } from "./acompanhamento.schemas.js";

const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const texto=(d:Date)=>d.toISOString().slice(0,10);
const json=(v:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(v));
function erro(message:string,campo?:string):never{throw new RebanhoError("VALIDACAO",message,campo);}

type OrigemDemanda = Pick<DemandaAcompanhamentoReprodutivo, "animalId" | "gestacaoId" | "finalidade" | "exameOrigemId" | "dataReferencia" | "origemAdocao">;
type ExameOrigem = {
 id: string; animalId: string; data: Date; status: string; realizacao: string;
 interpretacao: { gestacaoId: string | null } | null;
 resultados: ReadonlyArray<{ valor: Prisma.JsonValue }>;
};
const incluirExameOrigem = { interpretacao: { select: { gestacaoId: true } }, resultados: { where: { vigente: true, campo: "CONCLUSAO_GESTACIONAL" }, select: { valor: true } } } satisfies Prisma.ExameAnimalInclude;
function pendenciasOrigemDemanda(demanda: OrigemDemanda, exame: ExameOrigem | null | undefined): Array<"EXAME_ORIGEM_INVALIDO"> {
 if(demanda.origemAdocao==="PROTOCOLO")return exame?.id===demanda.exameOrigemId&&exame.animalId===demanda.animalId&&exame.status==="VALIDO"&&exame.realizacao==="REALIZADO"&&exame.data.getTime()===demanda.dataReferencia.getTime()?[]:["EXAME_ORIGEM_INVALIDO"];
 if (demanda.finalidade !== "RECONFIRMACAO" || !demanda.exameOrigemId) return [];
 const valida = exame?.id === demanda.exameOrigemId && exame.animalId === demanda.animalId
  && exame.status === "VALIDO" && exame.realizacao === "REALIZADO"
  && exame.interpretacao?.gestacaoId === demanda.gestacaoId
  && exame.data.getTime() === demanda.dataReferencia.getTime()
  && exame.resultados.some(r => r.valor === "POSITIVO");
 return valida ? [] : ["EXAME_ORIGEM_INVALIDO"];
}

export async function vincularExameDemandaTx(tx:Prisma.TransactionClient,demandaId:string,exameId:string){
 const [demanda,exame]=await Promise.all([tx.demandaAcompanhamentoReprodutivo.findUnique({where:{id:demandaId},include:{exameOrigem:{include:incluirExameOrigem}}}),tx.exameAnimal.findUnique({where:{id:exameId},include:{interpretacao:true}})]);
 if(!demanda||!exame||demanda.estado!=="PENDENTE"||demanda.animalId!==exame.animalId)erro("Demanda não está pendente para este animal", "demandaAcompanhamentoId");
 if(pendenciasOrigemDemanda(demanda,demanda.exameOrigem).length)erro("O primeiro DG que fundamentou esta demanda está inválido; regularize a evidência de origem antes de registrar sua resolução", "demandaAcompanhamentoId");
 const regra=demanda.regraSnapshot as Record<string,unknown>;
 const formato=exame.formatoSnapshot as Record<string,unknown>;
 if(!exame.finalidades.includes(demanda.finalidade)||(demanda.tentativaId?exame.interpretacao?.tentativaId!==demanda.tentativaId:demanda.gestacaoId?exame.interpretacao?.gestacaoId!==demanda.gestacaoId:demanda.origemAdocao!=="PROTOCOLO")||exame.data<demanda.dataReferencia)erro("Exame não corresponde à origem e finalidade da demanda", "demandaAcompanhamentoId");
 if(regra.tipoExameId&&(regra.tipoExameId!==exame.tipoExameId||regra.tipoExameVersao!==formato.versao))erro("Tipo ou versão de exame difere da regra congelada", "tipoExameId");
 await tx.exameAnimal.update({where:{id:exameId},data:{demandaAcompanhamentoId:demandaId}});
}

/** A evidência original permanece válida; a demanda guarda as reavaliações como outros exames. */
export async function garantirDemandaProtocoloTx(tx: Prisma.TransactionClient, tarefaId: string, exameId: string, usuarioId: number | null) {
 const existente=await tx.demandaAcompanhamentoReprodutivo.findUnique({where:{tarefaId}});
 if(existente)return existente;
 const exame=await tx.exameAnimal.findUniqueOrThrow({where:{id:exameId},include:{interpretacao:true,resultados:{where:{vigente:true,campo:"CONCLUSAO_GESTACIONAL"}}}});
 if(exame.status!=="VALIDO"||exame.realizacao!=="REALIZADO"||!exame.resultados.some(r=>r.valor==="INCONCLUSIVO"))return null;
 const tarefa=await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:tarefaId},include:{etapa:true,execucao:true}});
 if(exame.tarefaId!==tarefaId||exame.animalId!==tarefa.execucao.animalId||exame.propriedadeId!==tarefa.execucao.propriedadeId||!exame.interpretacao)
  erro("Exame incompatível com a tarefa de origem", "tarefaId");
 const finalidade=exame.finalidadePrincipal??"DIAGNOSTICO";
 const origem={tentativaId:exame.interpretacao.tentativaId,gestacaoId:exame.interpretacao.gestacaoId};
 const mesmaOrigem=origem.tentativaId?{tentativaId:origem.tentativaId}:origem.gestacaoId?{gestacaoId:origem.gestacaoId}:{tarefaId};
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:exame.animalId,finalidade,...mesmaOrigem},orderBy:[{ocorrencia:"desc"},{id:"asc"}]});
 const pendente=demandas.find(d=>d.estado==="PENDENTE"&&!d.tarefaId);
 if(pendente){
  const salva=await tx.demandaAcompanhamentoReprodutivo.update({where:{id:pendente.id},data:{tarefaId,versao:{increment:1}}});
  await tx.exameAnimal.update({where:{id:exame.id},data:{demandaAcompanhamentoId:salva.id}});
  return salva;
 }
 const formato=exame.formatoSnapshot as Record<string,unknown>;
 const criada=await tx.demandaAcompanhamentoReprodutivo.create({data:{animalId:exame.animalId,propriedadeOrigemId:tarefa.execucao.propriedadeId!,
  finalidade,...origem,ocorrencia:(demandas[0]?.ocorrencia??0)+1,politicaId:null,previstaPara:null,
  tarefaId,exameOrigemId:exame.id,dataReferencia:exame.data,origemAdocao:"PROTOCOLO",regraSnapshot:json({versao:1,efeito:"ALERTA",tipoExameId:exame.tipoExameId,tipoExameVersao:formato.versao,acao:tarefa.etapa.configuracao}),criadoPorId:usuarioId}});
 await tx.exameAnimal.update({where:{id:exame.id},data:{demandaAcompanhamentoId:criada.id}});
 await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:criada.id,animalId:exame.animalId,propriedadeId:tarefa.execucao.propriedadeId,acao:"REGISTRO_PROTOCOLO",usuarioId,depois:criada});
 return criada;
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
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId},include:{tentativa:{include:{tarefa:true}},gestacao:true,exameOrigem:true},orderBy:[{previstaPara:{sort:"asc",nulls:"last"}},{ocorrencia:"asc"},{id:"asc"}]});
 if(!demandas.length)return;
 const exames=await tx.exameAnimal.findMany({where:{animalId,status:"VALIDO",realizacao:"REALIZADO"},include:{interpretacao:true,resultados:{where:{vigente:true,campo:{in:["CONCLUSAO_GESTACIONAL","SEXO_FETAL"]}}}},orderBy:[{data:"asc"},{criadoEm:"asc"},{id:"asc"}]});
 const partos=await tx.partoAnimal.findMany({where:{animalId,status:"VALIDO"},orderBy:[{data:"asc"},{id:"asc"}]});
 const tentativas=await tx.tentativaReprodutiva.findMany({where:{animalId,status:"VALIDO"},include:{tarefa:true},orderBy:[{data:"asc"},{ordem:"asc"}]});
 const utilizados=new Set<string>();
 const tarefasReservadas=new Set(demandas.flatMap(d=>d.tarefaId?[d.tarefaId]:[]));
 const demandaPorTarefa=new Map(demandas.flatMap(d=>d.tarefaId?[[d.tarefaId,d.id] as const]:[]));
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
   if(compativel){tarefaId=compativel.id;tarefasReservadas.add(compativel.id);demandaPorTarefa.set(compativel.id,d.id);}
  }
  const fonte=d.tentativa??d.gestacao??(d.origemAdocao==="PROTOCOLO"?d.exameOrigem:null);
  const origemValida=pendenciasOrigemDemanda(d,exames.find(e=>e.id===d.exameOrigemId)).length===0;
  const parto=partos.find(p=>p.data>=d.dataReferencia&&(!d.gestacaoId||p.gestacaoId===d.gestacaoId));
  const substituta=d.tentativa?tentativas.find(t=>t.data>d.tentativa!.data||(t.data.getTime()===d.tentativa!.data.getTime()&&t.ordem>d.tentativa!.ordem)):null;
  const fim=[d.gestacao?.encerradaEm,parto?.data,substituta?.data].filter((data):data is Date=>!!data).sort((a,b)=>a.getTime()-b.getTime())[0]??null;
  const evidencia=exames.find(e=>{
   const i=e.interpretacao;
   if(e.tarefaId&&demandaPorTarefa.has(e.tarefaId)&&demandaPorTarefa.get(e.tarefaId)!==d.id)return false;
   if(!i||(e.demandaAcompanhamentoId&&e.demandaAcompanhamentoId!==d.id)||utilizados.has(e.id)||e.data<d.dataReferencia||(fim&&e.data>fim)||!e.finalidades.includes(d.finalidade))return false;
   if(d.tentativaId?i.tentativaId!==d.tentativaId:d.gestacaoId?i.gestacaoId!==d.gestacaoId:d.origemAdocao!=="PROTOCOLO")return false;
   if(d.finalidade==="RECONFIRMACAO"&&d.previstaPara&&e.data<d.previstaPara)return false;
   const formato=e.formatoSnapshot as Record<string,unknown>;
   if(regra.tipoExameId&&(e.tipoExameId!==regra.tipoExameId||formato.versao!==regra.tipoExameVersao))return false;
   return e.resultados.some(r=>d.finalidade==="SEXAGEM"?r.campo==="SEXO_FETAL"&&["F","M"].includes(String(r.valor)):r.campo==="CONCLUSAO_GESTACIONAL"&&["POSITIVO","NEGATIVO"].includes(String(r.valor)));
  });
  const conclusivo=evidencia;
  let dados:Prisma.DemandaAcompanhamentoReprodutivoUncheckedUpdateInput;
  if(conclusivo&&fonte?.status==="VALIDO"&&origemValida){
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
  const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:{in:locais.map(l=>l.animalId)},dataReferencia:{lte:dia(data)}},include:{exameOrigem:{include:incluirExameOrigem}},orderBy:[{previstaPara:{sort:"asc",nulls:"last"}},{id:"asc"}]});
  return demandas.map(({exameOrigem,...demanda})=>{
   const pendencias=pendenciasOrigemDemanda(demanda,exameOrigem);
   // A leitura revela resolução obsoleta sem reescrever o histórico ou adotar outra âncora.
   return {...demanda,...(pendencias.length&&demanda.estado!=="ENCERRADA"?{estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:null}:{}),pendencias};
  });
 });
}

/** Projeção usada por filtros e totais. Não adota regra nem repara demanda durante leitura. */
export function sqlOrigemValidaDemanda() {
 return Prisma.sql`CASE
  WHEN d."origemAdocao"='PROTOCOLO' THEN
   e.id=d."exameOrigemId" AND e."animalId"=d."animalId" AND e.status='VALIDO' AND e.realizacao='REALIZADO' AND e.data=d."dataReferencia"
  WHEN d.finalidade='RECONFIRMACAO' AND d."exameOrigemId" IS NOT NULL THEN
   e.id=d."exameOrigemId" AND e."animalId"=d."animalId" AND e.status='VALIDO' AND e.realizacao='REALIZADO' AND e.data=d."dataReferencia" AND i."gestacaoId"=d."gestacaoId"
   AND EXISTS(SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"POSITIVO"'::jsonb)
  ELSE true END`;
}
export function sqlDemandaPendenteTarefa(){
 return Prisma.sql`(EXISTS(SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d
  LEFT JOIN pecuaria."ExameAnimal" e ON e.id=d."exameOrigemId"
  LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
  WHERE d."tarefaId"=t.id AND (d.estado='PENDENTE' OR d.estado<>'ENCERRADA' AND NOT coalesce((${sqlOrigemValidaDemanda()}),false)))
  OR EXISTS(SELECT 1 FROM pecuaria."ExameAnimal" x WHERE x.status='VALIDO' AND x.realizacao='COLETA_REGISTRADA'
   AND (x."tarefaId"=t.id OR EXISTS(SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tarefaId"=t.id AND v.estado='ATUAL' AND v."exameId"=x.id))))`;
}

export async function listarAcompanhamentosPaginados(propriedadeId:number,entrada:unknown){
 const f=consultaAcompanhamentoSchema.parse(entrada);const data=f.data??new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 return prisma.$transaction(async tx=>{
  if(f.animalId)await conferirAnimalNoFato(tx,f.animalId,propriedadeId,dia(data));
  const escopo=f.animalId?Prisma.sql`d."animalId"=${f.animalId}`:Prisma.sql`EXISTS(SELECT 1 FROM pecuaria."LocalizacaoAnimal" l WHERE l."animalId"=d."animalId" AND l."propriedadeId"=${propriedadeId} AND l.desde<=${dia(data)} AND (l.ate IS NULL OR l.ate>${dia(data)}))`;
  const base=Prisma.sql`WITH demandas AS (SELECT d.id,d."previstaPara",d."dataReferencia",d.ocorrencia,
   CASE WHEN d.estado<>'ENCERRADA' AND NOT coalesce((${sqlOrigemValidaDemanda()}),false) THEN 'PENDENTE' ELSE d.estado END AS estado
   FROM pecuaria."DemandaAcompanhamentoReprodutivo" d
   LEFT JOIN pecuaria."ExameAnimal" e ON e.id=d."exameOrigemId"
   LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
   WHERE ${escopo} AND d."dataReferencia"<=${dia(data)} ${f.finalidade?Prisma.sql`AND d.finalidade=${f.finalidade}`:Prisma.empty})`;
  const filtro=f.estado?Prisma.sql`estado=${f.estado}`:Prisma.sql`true`;
  const [contagem]=await tx.$queryRaw<Array<{total:bigint}>>(Prisma.sql`${base} SELECT count(*) AS total FROM demandas WHERE ${filtro}`);
  const total=Number(contagem?.total??0);const pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/f.porPagina)));
  const [agregado]=await tx.$queryRaw<Array<{total:bigint;pendentes:bigint;resolvidas:bigint;encerradas:bigint;semData:bigint}>>(Prisma.sql`${base} SELECT count(*) AS total,count(*) FILTER(WHERE estado='PENDENTE') AS pendentes,count(*) FILTER(WHERE estado='RESOLVIDA') AS resolvidas,count(*) FILTER(WHERE estado='ENCERRADA') AS encerradas,count(*) FILTER(WHERE "previstaPara" IS NULL) AS "semData" FROM demandas`);
  const ids=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`${base} SELECT id FROM demandas WHERE ${filtro} ORDER BY "previstaPara" ASC NULLS LAST,ocorrencia ASC,id ASC LIMIT ${f.porPagina} OFFSET ${(pagina-1)*f.porPagina}`);
  const registros=ids.length?await tx.demandaAcompanhamentoReprodutivo.findMany({where:{id:{in:ids.map(i=>i.id)}},include:{exameOrigem:{include:incluirExameOrigem}}}):[];
  const itens=ids.map(({id})=>{const {exameOrigem,...demanda}=registros.find(d=>d.id===id)!;const pendencias=pendenciasOrigemDemanda(demanda,exameOrigem);return {...demanda,...(pendencias.length&&demanda.estado!=="ENCERRADA"?{estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:null}:{}),pendencias};});
  return{itens,total,pagina,porPagina:f.porPagina,resumo:{total:Number(agregado?.total??0),pendentes:Number(agregado?.pendentes??0),resolvidas:Number(agregado?.resolvidas??0),encerradas:Number(agregado?.encerradas??0),semData:Number(agregado?.semData??0)}};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
