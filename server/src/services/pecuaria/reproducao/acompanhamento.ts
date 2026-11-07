import { tarefaComPrazoHerdado } from "./prazo-tarefa.calc.js";
import { proporPrazoDaParticipacao, proporReconfirmacoesDaParticipacao } from "./prazos-protocolo.js";
import { Prisma, type DemandaAcompanhamentoReprodutivo } from "@prisma/client";
import { referenciaConclusaoReprodutiva, resultadoConclusivoPorFinalidade } from "./conclusoes-acompanhamento.calc.js";
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

/** Vinculações explícitas usam resultados distintos de uma única realização. */
export async function vincularConclusoesExameTx(tx: Prisma.TransactionClient, exameId: string, vinculos: readonly { demandaId: string; campo: "CONCLUSAO_GESTACIONAL" | "SEXO_FETAL" | "APTIDAO_REPRODUTIVA" }[], usuarioId: number | null) {
 if(new Set(vinculos.map(v=>v.demandaId)).size!==vinculos.length || new Set(vinculos.map(v=>v.campo)).size!==vinculos.length)
  erro("Cada conclusão e cada demanda podem aparecer uma única vez", "vinculosConclusao");
 const exame=await tx.exameAnimal.findUniqueOrThrow({where:{id:exameId},include:{resultados:{where:{vigente:true}},interpretacao:true}});
 for(const v of vinculos){
  const demanda=await tx.demandaAcompanhamentoReprodutivo.findUnique({where:{id:v.demandaId}});
  if(!demanda||demanda.estado!=="PENDENTE"||demanda.animalId!==exame.animalId||demanda.propriedadeOrigemId!==exame.propriedadeId)
   erro("Demanda pendente não pertence ao animal e ao sítio da avaliação", "vinculosConclusao");
  const finalidadeEsperada=v.campo==="SEXO_FETAL" ? "SEXAGEM" : v.campo==="APTIDAO_REPRODUTIVA" ? "APTIDAO_REPRODUTIVA" : null;
  if(finalidadeEsperada ? demanda.finalidade!==finalidadeEsperada : !["DIAGNOSTICO","RECONFIRMACAO"].includes(demanda.finalidade))
   erro("Conclusão não atende à finalidade selecionada", "vinculosConclusao");
  const referencia=referenciaConclusaoReprodutiva(v.campo,exame);
  if(!referencia)erro("Conclusão selecionada não foi realizada ou é inconclusiva", "vinculosConclusao");
  const valorSnapshot=referencia.fonte==="RESULTADO" ? exame.resultados.find(r=>r.id===referencia.id)!.valor : exame.interpretacao!.resultadoAptidao;
  if(valorSnapshot==null)erro("Conclusão selecionada não possui valor", "vinculosConclusao");
  const criado=await tx.vinculoConclusaoAcompanhamento.create({data:{demandaId:demanda.id,fonte:referencia.fonte,valorSnapshot:valorSnapshot as Prisma.InputJsonValue,...(referencia.fonte==="RESULTADO"?{resultadoId:referencia.id}:{interpretacaoId:referencia.id}),criadoPorId:usuarioId}});
  const salva=await tx.demandaAcompanhamentoReprodutivo.update({where:{id:demanda.id},data:{estado:"RESOLVIDA",vinculoConclusaoResolucaoId:criado.id,exameResolucaoId:null,resolvidaEm:exame.data,resolucaoSnapshot:json({exameId,referencia,data:texto(exame.data),formato:exame.formatoSnapshot}),versao:{increment:1}}});
  await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:demanda.id,animalId:exame.animalId,propriedadeId:demanda.propriedadeOrigemId,acao:"VINCULO_CONCLUSAO",usuarioId,antes:demanda,depois:salva});
 }
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
export async function validarTiposPoliticaTx(tx:Prisma.TransactionClient,parametros:import("./acompanhamento.schemas.js").ParametrosAcompanhamento){
 for(const regra of (parametros.versao===1?[...(parametros.diagnostico?[parametros.diagnostico]:[]),...parametros.reconfirmacoes]:parametros.regras))if(regra.tipoExameId){
  const tipo=await tx.tipoExame.findUnique({where:{id:regra.tipoExameId}});
  if(!tipo||!tipo.ativo||tipo.contexto==="SANITARIO"||tipo.tipoResultado!=="MULTIPLO")erro("Selecione um tipo de exame reprodutivo ativo", "tipoExameId");
  if(regra.tipoExameVersao&&regra.tipoExameVersao!==tipo.versaoFormato)throw new RebanhoError("CONFLITO","A versão do tipo de exame mudou; confira a política");
  regra.tipoExameVersao=tipo.versaoFormato;
 }
 return parametros;
}
export async function criarPoliticaAcompanhamentoTx(tx:Prisma.TransactionClient,input:CriarPoliticaAcompanhamentoInput,usuarioId:number|null){
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-politica-acompanhamento:${input.propriedadeId}`}))`;
  return operacaoIdempotenteTx(tx,input,usuarioId,"POLITICA_ACOMPANHAMENTO",async()=>{
   const parametros=parametrosAcompanhamentoSchema.parse(input.parametros);
   await validarTiposPoliticaTx(tx,parametros);
   const anterior=await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{propriedadeId:input.propriedadeId},orderBy:{versao:"desc"}});
   if(anterior&&dia(input.vigenteDesde)<=anterior.vigenteDesde)erro("Nova vigência deve ser posterior à última versão; demandas existentes conservam a regra", "vigenteDesde");
   const criada=await tx.politicaAcompanhamentoReprodutivo.create({data:{propriedadeId:input.propriedadeId,versao:(anterior?.versao??0)+1,vigenteDesde:dia(input.vigenteDesde),parametros:json(parametros),criadoPorId:usuarioId}});
   await auditar(tx,{entidade:"PoliticaAcompanhamentoReprodutivo",entidadeId:criada.id,propriedadeId:input.propriedadeId,acao:"REGISTRO",usuarioId,depois:criada});
   return criada;
  });
}
export function criarPoliticaAcompanhamento(input:CriarPoliticaAcompanhamentoInput,usuarioId:number|null){
 return transacaoPecuaria(tx=>criarPoliticaAcompanhamentoTx(tx,input,usuarioId));
}

type Origem={tipoTentativa?:string;tentativaId?:string;gestacaoId?:string;animalId:string;propriedadeId:number;data:Date;exameOrigemId?:string};
async function propostasTx(tx:Prisma.TransactionClient,origem:Origem,politicaId?:string){
 const politica=await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{propriedadeId:origem.propriedadeId,...(politicaId?{id:politicaId}:{vigenteDesde:{lte:origem.data}})},orderBy:{vigenteDesde:"desc"}});
 if(!politica){if(politicaId)erro("Política não pertence ao sítio de origem", "politicaId");return [];}
 return proporAcompanhamentos({...politica,parametros:parametrosAcompanhamentoSchema.parse(politica.parametros)},{...origem,data:texto(origem.data)}).map(p=>({...p,politicaId:politica.id}));
}
/** Propostas de política para uma gestação que ainda será criada, sem adotar nem persistir. */
export async function preverDemandasNovaGestacaoTx(tx: Prisma.TransactionClient, origem: { animalId: string; propriedadeId: number; data: Date }) {
 const propostas=await propostasTx(tx,{...origem,gestacaoId:"PREVIA"});
 return propostas.map(({gestacaoId: _gestacaoId, ...proposta})=>proposta);
}
/** Somente escritores chamam esta função. Uma leitura nunca adota políticas em fatos antigos. */
export async function criarDemandasDoFatoTx(tx:Prisma.TransactionClient,origem:Origem,usuarioId:number|null,politicaId?:string,participacaoId?:string){
 let propostas: Array<import("./prazos-protocolo.js").PrazoAdotado>;
 if(participacaoId && origem.tentativaId && origem.tipoTentativa && !politicaId){
  const participacao=await tx.participacaoProtocolo.findFirst({where:{id:participacaoId,animalId:origem.animalId,propriedadeId:origem.propriedadeId,tarefas:{some:{tentativas:{some:{id:origem.tentativaId,status:"VALIDO"}}}}},select:{acompanhamentoSnapshot:true}});
  if(!participacao)erro("Tentativa não vinculada à participação informada", "participacaoId");
  propostas=participacao.acompanhamentoSnapshot ? proporPrazoDaParticipacao(participacao.acompanhamentoSnapshot,{tentativaId:origem.tentativaId,tipoTentativa:origem.tipoTentativa,data:texto(origem.data)},participacaoId)
   : (await propostasTx(tx,origem)).map(p=>({...p,origemAdocao:"FATO_NOVO" as const,participacaoAcompanhamentoId:null}));
 }else if(origem.gestacaoId && !politicaId){
  const gestacao=await tx.gestacaoAnimal.findUnique({where:{id:origem.gestacaoId},select:{TentativaReprodutiva:{select:{tarefa:{select:{execucao:{select:{id:true,animalId:true,propriedadeId:true,acompanhamentoSnapshot:true}}}}}}}});
  const participacao=gestacao?.TentativaReprodutiva?.tarefa?.execucao;
  propostas=participacao && participacao.animalId===origem.animalId && participacao.propriedadeId===origem.propriedadeId && participacao.acompanhamentoSnapshot
   ? proporReconfirmacoesDaParticipacao(participacao.acompanhamentoSnapshot,{gestacaoId:origem.gestacaoId,data:texto(origem.data)},participacao.id)
   : (await propostasTx(tx,origem)).map(p=>({...p,origemAdocao:"FATO_NOVO" as const,participacaoAcompanhamentoId:null}));
 }else propostas=(await propostasTx(tx,origem,politicaId)).map(p=>({...p,origemAdocao:politicaId?"ADOCAO_EXPLICITA" as const:"FATO_NOVO" as const,participacaoAcompanhamentoId:null}));
 for(const p of propostas){
  const existente=await tx.demandaAcompanhamentoReprodutivo.findFirst({where:{tentativaId:p.tentativaId,gestacaoId:p.gestacaoId,finalidade:p.finalidade,ocorrencia:p.ocorrencia}});
  if(existente)continue;
  const criada=await tx.demandaAcompanhamentoReprodutivo.create({data:{animalId:origem.animalId,propriedadeOrigemId:origem.propriedadeId,politicaId:p.politicaId,participacaoAcompanhamentoId:p.participacaoAcompanhamentoId,finalidade:p.finalidade,ocorrencia:p.ocorrencia,tentativaId:p.tentativaId,gestacaoId:p.gestacaoId,dataReferencia:dia(p.dataReferencia),previstaPara:p.previstaPara?dia(p.previstaPara):null,regraSnapshot:json(p.regraSnapshot),origemAdocao:p.origemAdocao,exameOrigemId:origem.exameOrigemId,criadoPorId:usuarioId}});
  await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:criada.id,animalId:origem.animalId,propriedadeId:origem.propriedadeId,acao:politicaId?"ADOCAO_EXPLICITA":"REGISTRO",usuarioId,depois:criada});
 }
}

/** Reavalia apenas demandas já criadas, inclusive quando uma evidência é anulada. Não aplica uma política nova. */
export async function reconciliarDemandasAnimalTx(tx:Prisma.TransactionClient,animalId:string,usuarioId:number|null){
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId},include:{tentativa:{include:{tarefa:true}},gestacao:true,exameOrigem:true,vinculoConclusaoResolucao:true},orderBy:[{previstaPara:{sort:"asc",nulls:"last"}},{ocorrencia:"asc"},{id:"asc"}]});
 if(!demandas.length)return;
 const exames=await tx.exameAnimal.findMany({where:{animalId,status:"VALIDO",realizacao:"REALIZADO"},include:{interpretacao:true,resultados:{where:{vigente:true,campo:{in:["CONCLUSAO_GESTACIONAL","SEXO_FETAL"]}}}},orderBy:[{data:"asc"},{criadoEm:"asc"},{id:"asc"}]});
 const partos=await tx.partoAnimal.findMany({where:{animalId,status:"VALIDO"},orderBy:[{data:"asc"},{id:"asc"}]});
 const tentativas=await tx.tentativaReprodutiva.findMany({where:{animalId,status:"VALIDO"},include:{tarefa:true},orderBy:[{data:"asc"},{ordem:"asc"}]});
 const utilizados=new Set<string>();
 const resultadosReservados=new Map(demandas.flatMap(d=>d.vinculoConclusaoResolucao?.vigente&&d.vinculoConclusaoResolucao.resultadoId?[[d.vinculoConclusaoResolucao.resultadoId,d.id] as const]:[]));
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
  const vinculo=d.vinculoConclusaoResolucao;
  const evidencia=exames.find(e=>{
   const i=e.interpretacao;
   if(!vinculo&&e.avaliacaoContextualSnapshot)return false;
   if(!vinculo&&e.tarefaId&&demandaPorTarefa.has(e.tarefaId)&&demandaPorTarefa.get(e.tarefaId)!==d.id)return false;
   if(!i||(!vinculo&&e.demandaAcompanhamentoId&&e.demandaAcompanhamentoId!==d.id)||(!vinculo&&utilizados.has(e.id))||e.data<d.dataReferencia||(fim&&e.data>fim)||!e.finalidades.includes(d.finalidade))return false;
   if(d.tentativaId?i.tentativaId!==d.tentativaId:d.gestacaoId?i.gestacaoId!==d.gestacaoId:d.origemAdocao!=="PROTOCOLO")return false;
   if(d.finalidade==="RECONFIRMACAO"&&d.previstaPara&&e.data<d.previstaPara)return false;
   const formato=e.formatoSnapshot as Record<string,unknown>;
   if(regra.tipoExameId&&(e.tipoExameId!==regra.tipoExameId||formato.versao!==regra.tipoExameVersao))return false;
   if(vinculo?.fonte==="INTERPRETACAO")return vinculo.vigente && d.finalidade==="APTIDAO_REPRODUTIVA" && e.interpretacao?.id===vinculo.interpretacaoId && e.interpretacao?.resultadoAptidao===vinculo.valorSnapshot && ["APTO","NAO_APTO"].includes(e.interpretacao?.resultadoAptidao??"");
   const resultado=resultadoConclusivoPorFinalidade(d.finalidade,e.resultados);
   return !!resultado && (vinculo ? vinculo.vigente && vinculo.resultadoId===resultado.id && vinculo.valorSnapshot===resultado.valor : !resultadosReservados.has(resultado.id));
  });
  const conclusivo=evidencia;
  let dados:Prisma.DemandaAcompanhamentoReprodutivoUncheckedUpdateInput;
  if(conclusivo&&fonte?.status==="VALIDO"&&origemValida){
   if(!vinculo)utilizados.add(conclusivo.id);
   dados={estado:"RESOLVIDA",exameResolucaoId:vinculo?null:conclusivo.id,vinculoConclusaoResolucaoId:vinculo?.id??null,resolvidaEm:conclusivo.data,resolucaoSnapshot:json({exameId:conclusivo.id,...(vinculo?{fonte:vinculo.fonte,resultadoId:vinculo.resultadoId,interpretacaoId:vinculo.interpretacaoId}:{}),data:texto(conclusivo.data),formato:conclusivo.formatoSnapshot}),encerradaEm:null,motivoEncerramento:null};
  }else if(fonte?.status!=="VALIDO"||fim){
   const motivo=fonte?.status!=="VALIDO"?"ORIGEM_ANULADA":d.gestacao?.encerradaEm?`GESTACAO_ENCERRADA_${d.gestacao.tipoEncerramento??"NAO_IDENTIFICADO"}`:parto?"CICLO_ENCERRADO_POR_PARTO":"TENTATIVA_SUBSTITUIDA";
   dados={estado:"ENCERRADA",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:Prisma.DbNull,encerradaEm:fim??new Date(),motivoEncerramento:motivo};
  }else dados={estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:Prisma.DbNull,encerradaEm:null,motivoEncerramento:null};
  if(vinculo&&!conclusivo || vinculo && (fonte?.status!=="VALIDO"||!origemValida)){
   await tx.vinculoConclusaoAcompanhamento.update({where:{id:vinculo.id},data:{vigente:false,invalidadoEm:new Date(),invalidadoPorId:usuarioId,motivoInvalidacao:"Evidência ou origem deixou de ser válida"}});
   dados.vinculoConclusaoResolucaoId=null;
  }
  dados.tarefaId=tarefaId;
  if(d.tarefaId===tarefaId&&d.estado===dados.estado&&d.exameResolucaoId===(dados.exameResolucaoId??null)&&(d.vinculoConclusaoResolucaoId??null)===(dados.vinculoConclusaoResolucaoId??null)&&d.motivoEncerramento===(dados.motivoEncerramento??null))continue;
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
 const origens:Origem[]=tentativas.map(t=>({tentativaId:t.id,tipoTentativa:t.tipo,animalId:t.animalId,propriedadeId:input.propriedadeId,data:t.data}));
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
  return carregarAcompanhamentosNaDataTx(tx,locais.map(l=>l.animalId),dia(data));
 });
}

/** IDs autorizados pelo chamador; a leitura compartilha a projeção de validade da origem sem escrever. */
export async function carregarAcompanhamentosNaDataTx(tx: Prisma.TransactionClient, animalIds: string[], referencia: Date) {
 if (!animalIds.length) return [];
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:{in:animalIds},dataReferencia:{lte:referencia}},include:{exameOrigem:{include:incluirExameOrigem}},orderBy:[{previstaPara:{sort:"asc",nulls:"last"}},{ocorrencia:"asc"},{id:"asc"}]});
 return demandas.map(({exameOrigem,...demanda})=>{
  const pendencias=pendenciasOrigemDemanda(demanda,exameOrigem);
  // A leitura revela resolução obsoleta sem reescrever o histórico ou adotar outra âncora.
  return {...demanda,...(pendencias.length&&demanda.estado!=="ENCERRADA"?{estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:null}:{}),pendencias};
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

/** Uma revisão nunca desloca tarefa/agendamento individual, nem altera necessidade atendida. */
async function previaRevisaoPrazosTx(tx: Prisma.TransactionClient, input: import("./acompanhamento.schemas.js").PreviaRevisaoPrazos) {
 const politica = await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{id:input.politicaId,propriedadeId:input.propriedadeId}});
 if(!politica)erro("Política não pertence ao sítio escolhido", "politicaId");
 const demandas = await tx.demandaAcompanhamentoReprodutivo.findMany({where:{id:{in:input.demandaIds},propriedadeOrigemId:input.propriedadeId},include:{tentativa:{select:{tipo:true,status:true}},gestacao:{select:{status:true,encerradaEm:true}},tarefa:{include:{eventos:{select:{id:true},take:1},_count:{select:{aplicacoes:true,exames:true,tentativas:true,manejos:true,vinculos:true}},execucao:{select:{canceladaEm:true,rodada:{select:{status:true}}}}}}},orderBy:{id:"asc"}});
 if(demandas.length!==input.demandaIds.length)erro("Demandas não pertencem ao sítio escolhido", "demandaIds");
 const parametros = parametrosAcompanhamentoSchema.parse(politica.parametros);
 const propostas = await Promise.all(demandas.map(async d=>{
  const fato = { ...(d.tentativaId ? {tentativaId:d.tentativaId,tipoTentativa:d.tentativa?.tipo} : {gestacaoId:d.gestacaoId!}), data:texto(d.dataReferencia) };
  const proposta = proporAcompanhamentos({...politica,parametros},fato).find(p=>p.finalidade===d.finalidade && p.ocorrencia===d.ocorrencia);
  const visitaAgendada = await tx.participanteVisita.findFirst({where:{animalId:d.animalId,status:"PENDENTE",snapshot:{path:["acompanhamento","id"],equals:d.id},AtividadeVisita:{VisitaVeterinaria:{propriedadeId:input.propriedadeId,encerradaEm:null}}},select:{id:true}});
  const tarefaHerdada = d.tarefa && !d.tarefa.execucao.canceladaEm && (!d.tarefa.execucao.rodada || d.tarefa.execucao.rodada.status==="ABERTA") && tarefaComPrazoHerdado(d.tarefa,d.previstaPara) ? {id:d.tarefa.id,previstaAnterior:d.tarefa.previstaPara.toISOString(),historico:d.tarefa.historicoReprogramacao} : null;
  const impedimento = d.estado!=="PENDENTE" ? "DEMANDA_NAO_PENDENTE" : d.tarefaId && !tarefaHerdada ? "AGENDAMENTO_INDIVIDUAL_PRESERVADO" : visitaAgendada ? "AGENDAMENTO_VISITA_PRESERVADO" : d.origemAdocao==="SEM_REGRA" && (d.regraSnapshot as Record<string,unknown>).motivo==="AGENDAMENTO_ANTERIOR_A_TENTATIVA" ? "AGENDAMENTO_INDIVIDUAL_PRESERVADO" : d.origemAdocao==="INDIVIDUAL" ? "AGENDAMENTO_INDIVIDUAL_PRESERVADO" : d.origemAdocao==="PROTOCOLO" ? "ORIGEM_PROTOCOLAR" : d.tentativa && d.tentativa.status!=="VALIDO" || d.gestacao && (d.gestacao.status!=="VALIDO" || d.gestacao.encerradaEm) ? "ORIGEM_INVALIDA" : !proposta ? "REGRA_NAO_CONFIGURADA" : d.politicaId===politica.id && d.previstaPara?.toISOString().slice(0,10)===proposta.previstaPara && hashDados(d.regraSnapshot)===hashDados(proposta.regraSnapshot) ? "SEM_ALTERACAO" : null;
  return {demandaId:d.id,animalId:d.animalId,versao:d.versao,politicaAnteriorId:d.politicaId,previstaAnterior:d.previstaPara?.toISOString().slice(0,10)??null,regraAnterior:d.regraSnapshot,tarefaHerdada,visitaAgendadaId:visitaAgendada?.id??null,proposta:proposta??null,impedimento};
 }));
 return {propostas,revisao:hashDados({politicaId:politica.id,politicaVersao:politica.versao,propostas})};
}
export function previaRevisaoPrazos(input: import("./acompanhamento.schemas.js").PreviaRevisaoPrazos) { return prisma.$transaction(tx=>previaRevisaoPrazosTx(tx,input)); }
export function revisarPrazos(input: import("./acompanhamento.schemas.js").RevisarPrazos,usuarioId:number|null) {
 return transacaoPecuaria(async tx=>{
  const inicial=await previaRevisaoPrazosTx(tx,input);
  await travarAnimais(tx,inicial.propostas.map(p=>p.animalId));
  return operacaoIdempotenteTx(tx,input,usuarioId,"REVISAO_PRAZOS_ACOMPANHAMENTO",async()=>{
   const atual=await previaRevisaoPrazosTx(tx,input);
   if(atual.revisao!==input.revisao)throw new RebanhoError("CONFLITO","As demandas ou regras mudaram; confira a prévia novamente");
   if(atual.propostas.some(p=>p.impedimento))erro("A seleção contém demandas que não podem ser revisadas; confira a prévia", "demandaIds");
   for(const p of atual.propostas){
    if(!p.proposta)throw new RebanhoError("CONFLITO","A demanda não possui regra anterior revisável");
    const revisao=await tx.revisaoPrazoAcompanhamento.create({data:{demandaId:p.demandaId,tarefaId:p.tarefaHerdada?.id??null,tarefaPrevistaAnterior:p.tarefaHerdada?new Date(p.tarefaHerdada.previstaAnterior):null,tarefaPrevistaNova:p.tarefaHerdada?dia(p.proposta.previstaPara):null,versaoAnterior:p.versao,politicaAnteriorId:p.politicaAnteriorId,politicaNovaId:input.politicaId,previstaAnterior:p.previstaAnterior?dia(p.previstaAnterior):null,previstaNova:dia(p.proposta.previstaPara),regraAnterior:json(p.regraAnterior),regraNova:json(p.proposta.regraSnapshot),motivo:input.motivo,usuarioId}});
    const atualizada=await tx.demandaAcompanhamentoReprodutivo.updateMany({where:{id:p.demandaId,versao:p.versao,estado:"PENDENTE",tarefaId:p.tarefaHerdada?.id??null},data:{politicaId:input.politicaId,...(!p.politicaAnteriorId?{origemAdocao:"ADOCAO_EXPLICITA"}:{}),previstaPara:dia(p.proposta.previstaPara),regraSnapshot:json(p.proposta.regraSnapshot),versao:{increment:1}}});
    if(atualizada.count!==1)throw new RebanhoError("CONFLITO","Demanda alterada durante a revisão");
    if(p.tarefaHerdada){
     const anterior=new Date(p.tarefaHerdada.previstaAnterior), historico=Array.isArray(p.tarefaHerdada.historico)?p.tarefaHerdada.historico:[];
     const tarefa=await tx.tarefaProtocolo.updateMany({where:{id:p.tarefaHerdada.id,previstaPara:anterior,realizadaEm:null,dispensadaEm:null,regularizacaoPendente:false},data:{previstaPara:dia(p.proposta.previstaPara),historicoReprogramacao:json([...historico,{acao:"REVISAO_REGRA_ACOMPANHAMENTO",revisaoId:revisao.id,previstaAnterior:anterior.toISOString().slice(0,10),previstaNova:p.proposta.previstaPara,motivo:input.motivo,usuarioId}])}});
     if(tarefa.count!==1)throw new RebanhoError("CONFLITO","Tarefa alterada durante a revisão");
    }
    await auditar(tx,{entidade:"DemandaAcompanhamentoReprodutivo",entidadeId:p.demandaId,animalId:p.animalId,propriedadeId:input.propriedadeId,acao:"REVISAO_PRAZO",usuarioId,antes:{politicaId:p.politicaAnteriorId,previstaPara:p.previstaAnterior,regra:p.regraAnterior},depois:{motivo:input.motivo,politicaId:input.politicaId,proposta:p.proposta}});
   }
   return {propostas:atual.propostas};
  });
 });
}

/** Projeção das atribuições explícitas de uma avaliação ainda não persistida. */
export async function preverConclusoesAvaliacaoTx(tx: Prisma.TransactionClient, proposta: {
 animalId: string; propriedadeId: number; data: Date; tentativaId: string | null; gestacaoId: string | null;
 tipoExameId: string; versaoFormato: number; finalidades: string[];
 resultados: readonly { campo: string; valor: unknown }[]; resultadoAptidao?: string | null;
 vinculos: readonly { demandaId: string; campo: "CONCLUSAO_GESTACIONAL" | "SEXO_FETAL" | "APTIDAO_REPRODUTIVA" }[];
}) {
 if(new Set(proposta.vinculos.map(v=>v.demandaId)).size!==proposta.vinculos.length || new Set(proposta.vinculos.map(v=>v.campo)).size!==proposta.vinculos.length)
  erro("Cada conclusão e cada demanda podem aparecer uma única vez", "vinculosConclusao");
 const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:proposta.animalId,propriedadeOrigemId:proposta.propriedadeId,estado:"PENDENTE"},
  include:{tentativa:true,gestacao:true,exameOrigem:{include:incluirExameOrigem}},orderBy:[{previstaPara:{sort:"asc",nulls:"last"}},{ocorrencia:"asc"},{id:"asc"}]});
 const [partos,tentativas]=await Promise.all([
  tx.partoAnimal.findMany({where:{animalId:proposta.animalId,status:"VALIDO"},orderBy:[{data:"asc"},{id:"asc"}]}),
  tx.tentativaReprodutiva.findMany({where:{animalId:proposta.animalId,status:"VALIDO"},orderBy:[{data:"asc"},{ordem:"asc"}]}),
 ]);
 const projecao=demandas.map(d=>{
  const regra=d.regraSnapshot as Record<string,unknown>, fonte=d.tentativa??d.gestacao??(d.origemAdocao==="PROTOCOLO"?d.exameOrigem:null);
  const parto=partos.find(p=>p.data>=d.dataReferencia&&(!d.gestacaoId||p.gestacaoId===d.gestacaoId));
  const substituta=d.tentativa?tentativas.find(t=>t.data>d.tentativa!.data||(t.data.getTime()===d.tentativa!.data.getTime()&&t.ordem>d.tentativa!.ordem)):null;
  const fim=[d.gestacao?.encerradaEm,parto?.data,substituta?.data].filter((v):v is Date=>!!v).sort((a,b)=>a.getTime()-b.getTime())[0];
  const resultado=resultadoConclusivoPorFinalidade(d.finalidade,proposta.resultados);
  const campo=d.finalidade==="APTIDAO_REPRODUTIVA" && ["APTO","NAO_APTO"].includes(proposta.resultadoAptidao??"") ? "APTIDAO_REPRODUTIVA" : resultado?.campo;
  const compativel=!!campo&&fonte?.status==="VALIDO"&&!pendenciasOrigemDemanda(d,d.exameOrigem).length
   &&proposta.data>=d.dataReferencia&&(!fim||proposta.data<=fim)&&proposta.finalidades.includes(d.finalidade)
   &&(d.tentativaId?proposta.tentativaId===d.tentativaId:d.gestacaoId?proposta.gestacaoId===d.gestacaoId:d.origemAdocao==="PROTOCOLO")
   &&(d.finalidade!=="RECONFIRMACAO"||!d.previstaPara||proposta.data>=d.previstaPara)
   &&(!regra.tipoExameId||regra.tipoExameId===proposta.tipoExameId&&regra.tipoExameVersao===proposta.versaoFormato);
  const escolhido=proposta.vinculos.find(v=>v.demandaId===d.id);
  if(escolhido&&(!compativel||escolhido.campo!==campo))erro("Conclusão não é compatível com a demanda ou sua origem", "vinculosConclusao");
  return { id:d.id, finalidade:d.finalidade, previstaPara:d.previstaPara, conclusaoCompativel:compativel?campo:null, acao:escolhido?"RESOLVER" as const:"PRESERVAR" as const };
 });
 if(proposta.vinculos.some(v=>!projecao.some(d=>d.id===v.demandaId)))erro("Demanda selecionada não está pendente no sítio e animal informados", "vinculosConclusao");
 return projecao;
}
