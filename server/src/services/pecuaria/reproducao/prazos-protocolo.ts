import { Prisma } from "@prisma/client";
import { parametrosAcompanhamentoSchema, parametrosAcompanhamentoV2Schema } from "./acompanhamento.schemas.js";
import { diaIatf } from "./horarios.calc.js";
import { RebanhoError } from "../rebanho/regras.js";

const json = (v:unknown):Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
/** Congela todas as camadas na adesão; ausência não adota regra criada mais tarde. */
export async function snapshotPrazosAdesaoTx(tx:Prisma.TransactionClient,protocoloId:string,propriedadeId:number,diagnosticoIndividualEm?:string) {
 const protocolo=await tx.protocolo.findFirst({where:{id:protocoloId,tipo:"REPRODUTIVO"},select:{id:true,versao:true,configuracaoAcompanhamento:true}});
 if(!protocolo)throw new RebanhoError("NAO_ENCONTRADO","Versão reprodutiva não encontrada");
 const hoje=new Date(`${diaIatf(new Date())}T00:00:00Z`);
 const politica=await tx.politicaAcompanhamentoReprodutivo.findFirst({where:{propriedadeId,vigenteDesde:{lte:hoje}},orderBy:{vigenteDesde:"desc"}});
 const modelo=protocolo.configuracaoAcompanhamento ? parametrosAcompanhamentoV2Schema.parse(protocolo.configuracaoAcompanhamento) : null;
 return json({versao:1,protocoloId:protocolo.id,protocoloVersao:protocolo.versao,diagnosticoIndividualEm:diagnosticoIndividualEm??null,modelo,
  sitio:politica?{id:politica.id,versao:politica.versao,parametros:parametrosAcompanhamentoSchema.parse(politica.parametros)}:null});
}

import { z } from "zod";
import { proporAcompanhamentos, type PropostaAcompanhamento } from "./acompanhamento.calc.js";
const snapshotSchema=z.object({versao:z.literal(1),protocoloId:z.string(),protocoloVersao:z.number().int().positive(),diagnosticoIndividualEm:z.string().date().nullable(),modelo:parametrosAcompanhamentoV2Schema.nullable(),sitio:z.object({id:z.string(),versao:z.number().int().positive(),parametros:parametrosAcompanhamentoSchema}).strict().nullable()}).strict();
export type PrazoAdotado = Omit<PropostaAcompanhamento,"previstaPara"> & {previstaPara:string|null;politicaId:string|null;origemAdocao:"INDIVIDUAL"|"MODELO"|"SEM_REGRA"|"FATO_NOVO"|"ADOCAO_EXPLICITA";participacaoAcompanhamentoId:string|null};
/** Seleciona por necessidade e tipo; data individual é preservada mesmo quando deixa de ser possível. */
export function proporPrazoDaParticipacao(snapshot:unknown,fato:{tentativaId:string;tipoTentativa:string;data:string},participacaoId:string):PrazoAdotado[] {
 const s=snapshotSchema.parse(snapshot);
 const origem={finalidade:"DIAGNOSTICO" as const,ocorrencia:1,tentativaId:fato.tentativaId,gestacaoId:null,dataReferencia:fato.data};
 const comum={versao:2,efeito:"ALERTA",protocoloId:s.protocoloId,participacaoId};
 const semRegra=(motivo:string):PrazoAdotado[] => [{...origem,previstaPara:null,politicaId:null,origemAdocao:"SEM_REGRA",participacaoAcompanhamentoId:participacaoId,regraSnapshot:{...comum,origem:"SEM_REGRA",referencia:fato.tipoTentativa,motivo}}];
 if(s.diagnosticoIndividualEm){
  if(s.diagnosticoIndividualEm<fato.data)return semRegra("AGENDAMENTO_ANTERIOR_A_TENTATIVA");
  return [{...origem,previstaPara:s.diagnosticoIndividualEm,politicaId:null,origemAdocao:"INDIVIDUAL",participacaoAcompanhamentoId:participacaoId,regraSnapshot:{...comum,origem:"INDIVIDUAL",referencia:fato.tipoTentativa,dataIndividual:s.diagnosticoIndividualEm,resolucao:"DIAGNOSTICO_CONCLUSIVO"}}];
 }
 const regra=s.modelo?.regras.find(r=>r.finalidade==="DIAGNOSTICO"&&r.publico===fato.tipoTentativa);
 if(regra){
  const previstaPara=new Date(new Date(`${fato.data}T00:00:00Z`).getTime()+regra.intervalo*86400000).toISOString().slice(0,10);
  return [{...origem,previstaPara,politicaId:null,origemAdocao:"MODELO",participacaoAcompanhamentoId:participacaoId,regraSnapshot:{...comum,origem:"MODELO",referencia:regra.referencia,regra,tipoExameId:regra.tipoExameId??null,tipoExameVersao:regra.tipoExameVersao??null}}];
 }
 if(!s.sitio)return semRegra("REGRA_NAO_CONFIGURADA");
 const propostas=proporAcompanhamentos(s.sitio,fato).map(p=>({...p,politicaId:s.sitio!.id,origemAdocao:"FATO_NOVO" as const,participacaoAcompanhamentoId:null}));
 return propostas.length?propostas:semRegra("REGRA_NAO_CONFIGURADA");
}

/** Reconfirmações do modelo sobrepõem apenas ocorrências equivalentes do sítio congelado. */
export function proporReconfirmacoesDaParticipacao(snapshot:unknown,fato:{gestacaoId:string;data:string},participacaoId:string):PrazoAdotado[] {
 const s=snapshotSchema.parse(snapshot);
 const regras=s.modelo?.regras.filter(r=>r.finalidade==="RECONFIRMACAO")??[];
 const doModelo:PrazoAdotado[]=regras.map(regra=>({finalidade:"RECONFIRMACAO",ocorrencia:regra.ocorrencia,tentativaId:null,gestacaoId:fato.gestacaoId,dataReferencia:fato.data,
  previstaPara:new Date(new Date(`${fato.data}T00:00:00Z`).getTime()+regra.intervalo*86400000).toISOString().slice(0,10),politicaId:null,origemAdocao:"MODELO",participacaoAcompanhamentoId:participacaoId,
  regraSnapshot:{versao:2,efeito:"ALERTA",protocoloId:s.protocoloId,participacaoId,origem:"MODELO",referencia:regra.referencia,regra,tipoExameId:regra.tipoExameId??null,tipoExameVersao:regra.tipoExameVersao??null}}));
 const doSitio=s.sitio?proporAcompanhamentos(s.sitio,fato).filter(p=>!regras.some(r=>r.ocorrencia===p.ocorrencia)).map(p=>({...p,politicaId:s.sitio!.id,origemAdocao:"FATO_NOVO" as const,participacaoAcompanhamentoId:null})):[];
 return [...doModelo,...doSitio].sort((a,b)=>a.ocorrencia-b.ocorrencia);
}
