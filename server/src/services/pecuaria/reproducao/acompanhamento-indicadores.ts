import { calcularElegibilidadesDoConjunto, type DadosElegibilidade, type EntradaElegibilidade } from "./elegibilidade.calc.js";
import { calcularAcompanhamentoIndicadores, type DadosAcompanhamentoIndicadores, type CicloAcompanhamentoIndicador, type LocalIndicadorAcompanhamento } from "./acompanhamento-indicadores.calc.js";
import { resolverPapelReprodutivo } from "../rebanho/papel-reprodutivo.calc.js";
import { classificarTentativaIndicador, type DadosIndicadores } from "./indicadores.calc.js";
import type { ConsultaIndicadoresInput } from "./indicadores.schemas.js";
import { desfechoGestacao } from "./desfecho-gestacao.calc.js";
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const texto=(d:Date)=>d.toISOString().slice(0,10);
const somar=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);

function localNaData(d:DadosElegibilidade,animalId:string,data:Date):LocalIndicadorAcompanhamento{
 const locais=d.localizacoes.filter(l=>l.animalId===animalId&&l.desde<=data&&(!l.ate||l.ate>data));
 const papel=resolverPapelReprodutivo(d.papeis.filter(p=>p.animalId===animalId),data);
 return {propriedadeId:locais.length===1?locais[0].propriedadeId:null,loteId:locais.length===1?locais[0].loteId:null,papel:papel.estado==="CONFLITO"?null:papel.papel};
}
function explicacaoObservacional(p:{observacao?:string|null;origem?:string}){
 if(p.origem==="IDEAGRI"&&p.observacao){
  try{const documento:unknown=JSON.parse(p.observacao);if(documento&&typeof documento==="object"&&!Array.isArray(documento)&&"original" in documento&&"criasSemReferencia" in documento&&"desfecho" in documento)return undefined;}catch{/* Texto observacional original é preservado como texto. */}
 }
 return p.observacao??undefined;
}
function coberturaOperacional(d:DadosElegibilidade,animalId:string,desde:Date,ate:Date){
 if(d.baixas.some(b=>b.animalId===animalId&&!b.estornadaEm&&b.data>=desde&&b.data<=ate))return false;
 const locais=d.localizacoes.filter(l=>l.animalId===animalId&&l.desde<=ate&&(!l.ate||l.ate>desde));
 const pontos=[desde,...locais.flatMap(l=>[l.desde,...(l.ate?[l.ate]:[])]).filter(data=>data>desde&&data<=ate)];
 return pontos.every(data=>locais.filter(l=>l.desde<=data&&(!l.ate||l.ate>data)).length===1);
}

/** Adapter factual. Não cria políticas, ciclos, demandas nem intervalos de seguimento presumidos. */
export function construirDadosAcompanhamento(dados:DadosIndicadores,f:ConsultaIndicadoresInput):DadosAcompanhamentoIndicadores{
 const d=dados.elegibilidade,corte=dia(f.corte),ciclos:CicloAcompanhamentoIndicador[]=[];
 const pendenciasOrigemCiclo:NonNullable<DadosAcompanhamentoIndicadores["pendenciasOrigemCiclo"]>=[];
 for(const animal of d.animais.filter(a=>a.sexo==="F")){
  const partos=d.partos.filter(p=>p.animalId===animal.id&&p.status==="VALIDO"&&p.data<=corte).sort((a,b)=>a.data.getTime()-b.data.getTime()||a.id.localeCompare(b.id));
  const inicial=d.iniciais.filter(i=>i.animalId===animal.id&&i.status==="VALIDO"&&i.data<=corte).sort((a,b)=>a.data.getTime()-b.data.getTime())[0];
  const inicios=[...(inicial&&(!partos.length||inicial.data<partos[0].data)?[{data:inicial.data,partoId:null,chave:"INICIAL"}]:[]),...partos.map(p=>({data:p.data,partoId:p.id,chave:`PARTO:${p.id}`}))];
  if(!inicios.length&&localNaData(d,animal.id,corte).propriedadeId===f.propriedadeId)pendenciasOrigemCiclo.push({animalId:animal.id,motivo:"INICIO_CICLO_NAO_COMPROVADO",local:localNaData(d,animal.id,corte)});
  for(const [indice,inicio] of inicios.entries()){
   const fim=inicios[indice+1]?.data??null;
   const tentativas=d.tentativas.filter(t=>t.animalId===animal.id&&t.status==="VALIDO"&&t.data>=inicio.data&&(!fim||t.data<fim)&&t.data<=corte).sort((a,b)=>a.data.getTime()-b.data.getTime()||a.ordem-b.ordem);
   const vinculo=d.vinculos.find(v=>v.animalId===animal.id&&v.chaveCiclo===inicio.chave);
   const politica=d.politicas.find(p=>p.id===vinculo?.politicaId)?.parametros as {pevPrimiparasDias?:number;pevMultiparasDias?:number;pevAposAbortoDias?:number|null;aborto?:string;restricoes?:string}|undefined;
   const parto=partos.find(p=>p.id===inicio.partoId);
   const paridade=animal.partosAntesDaEntrada+partos.filter(p=>p.data<=inicio.data&&!p.incluidoSaldoAnterior).length;
   const pevDias=parto?(parto.desfecho==="ABORTO"||parto.tipo==="ABORTO"?politica?.aborto==="PEV_CONFIGURADO"?politica.pevAposAbortoDias:null:paridade===1?politica?.pevPrimiparasDias:politica?.pevMultiparasDias):null;
   const fimPev=pevDias==null?null:somar(inicio.data,pevDias);
   const datas=new Set([texto(inicio.data),f.corte,...(fimPev?[texto(fimPev)]:[])]);
   for(const i of d.iniciais.filter(i=>i.animalId===animal.id))for(const data of [i.data,i.aptaDesde])if(data)datas.add(texto(data));
   for(const dec of d.decisoes.filter(dec=>dec.vinculoCicloId===vinculo?.id))for(const data of [dec.data,dec.aptaDesde])if(data)datas.add(texto(data));
   for(const r of d.restricoes.filter(r=>r.animalId===animal.id))for(const data of [r.data,r.ate])if(data)datas.add(texto(data));
   for(const l of d.localizacoes.filter(l=>l.animalId===animal.id))for(const data of [l.desde,l.ate])if(data)datas.add(texto(data));
   for(const p of d.papeis.filter(p=>p.animalId===animal.id))for(const data of [p.inicio,p.fim])if(data)datas.add(texto(data));
   for(const t of tentativas)datas.add(texto(t.data));
   for(const g of d.gestacoes.filter(g=>g.animalId===animal.id))for(const data of [g.confirmadaEm,g.encerradaEm])if(data)datas.add(texto(data));
   for(const a of d.avaliacoes.filter(a=>a.animalId===animal.id))datas.add(texto(a.data));
   const candidatos=[];
   for(const data of [...datas].filter(data=>data>=texto(inicio.data)&&data<=f.corte&&(!fim||data<texto(fim))).sort()){
    const entradas=new Map<string,EntradaElegibilidade>();
    // No dia do primeiro serviço, examina a situação imediatamente anterior a esse serviço.
    const primeiro=tentativas[0],antesDoServico=primeiro&&texto(primeiro.data)===data;
    const gestacoesDoServico=antesDoServico?new Set(d.gestacoes.filter(g=>g.tentativaId===primeiro.id).map(g=>g.id)):new Set<string>();
    const base=antesDoServico?{...d,tentativas:d.tentativas.filter(t=>t.id!==primeiro.id),avaliacoes:d.avaliacoes.filter(a=>!(a.data.getTime()===primeiro.data.getTime()&&(a.tentativaId===primeiro.id||!!a.gestacaoId&&gestacoesDoServico.has(a.gestacaoId)))),gestacoes:d.gestacoes.filter(g=>!gestacoesDoServico.has(g.id)||g.confirmadaEm>primeiro.data)}:d;
    calcularElegibilidadesDoConjunto({...base,animais:[animal]},f.propriedadeId,dia(data),entradas);
    const entrada=entradas.get(animal.id);
    if(entrada){const {referencia:_referencia,...contexto}=entrada;candidatos.push({data,contexto});}
   }
   const baixa=d.baixas.filter(b=>b.animalId===animal.id&&!b.estornadaEm&&b.data>=inicio.data).sort((a,b)=>a.data.getTime()-b.data.getTime())[0]?.data;
   const locais=d.localizacoes.filter(l=>l.animalId===animal.id&&l.propriedadeId===f.propriedadeId&&l.desde<=corte&&(!l.ate||l.ate>inicio.data)).sort((a,b)=>a.desde.getTime()-b.desde.getTime());
   const saidaLocal=locais.find(l=>l.ate&&l.ate<=corte&&!d.localizacoes.some(n=>n.animalId===animal.id&&n.propriedadeId===f.propriedadeId&&n.desde.getTime()===l.ate!.getTime()))?.ate;
   const saida=[baixa,saidaLocal].filter((v):v is Date=>!!v).sort((a,b)=>a.getTime()-b.getTime())[0]??null;
   ciclos.push({id:`${animal.id}:${inicio.chave}`,chaveCiclo:inicio.chave,animalId:animal.id,inicio:texto(inicio.data),fim:fim?texto(fim):null,partoId:inicio.partoId,partoEm:parto?texto(parto.data):null,fimPev:fimPev?texto(fimPev):null,saidaEm:saida?texto(saida):null,baixaEm:baixa?texto(baixa):null,localInicio:localNaData(d,animal.id,inicio.data),localCorte:localNaData(d,animal.id,corte),servicos:tentativas.filter(t=>["IA","TE","COBERTURA"].includes(t.tipo)).map(t=>({id:t.id,data:texto(t.data),tipo:t.tipo as "IA"|"TE"|"COBERTURA",valido:true,propriedadeId:t.propriedadeId,ordem:t.ordem,local:localNaData(d,animal.id,t.data)})),candidatosLiberacao:candidatos,restricoes:d.restricoes.filter(r=>r.animalId===animal.id&&r.status==="VALIDO"&&r.data<=corte&&(!r.ate||r.ate>inicio.data)).map(r=>({id:r.id,inicio:texto(r.data),fim:r.ate?texto(r.ate):null,efeito:politica?.restricoes==="APENAS_ALERTAR"?"ALERTA":"BLOQUEIO"}))});
  }
 }
 const partos=d.partos.filter(p=>p.status==="VALIDO").map(p=>({id:p.id,animalId:p.animalId,data:texto(p.data),valido:true,local:localNaData(d,p.animalId,p.data),desfecho:(p.desfecho==="ABORTO"||p.tipo==="ABORTO"?"ABORTO":p.tipo==="NATIMORTO"?"NATIMORTO":p.crias?.some(c=>c.viva)?"VIVO":p.crias?.length?"NATIMORTO":"DESCONHECIDO") as "ABORTO"|"NATIMORTO"|"VIVO"|"DESCONHECIDO"}));
 const gestacoes=d.gestacoes.map(g=>{
  const positivos=dados.evidencias.filter(e=>e.animalId===g.animalId&&e.gestacaoId===g.id&&e.status==="VALIDO"&&e.resultado==="POSITIVO"&&e.data<=corte).sort((a,b)=>a.data.getTime()-b.data.getTime()||a.id.localeCompare(b.id));
  const parto=d.partos.find(p=>p.gestacaoId===g.id&&p.status==="VALIDO");
  const evidencias=[...positivos.map(e=>({id:e.id,gestacaoId:g.id,data:texto(e.data),tipo:"DG_POSITIVO" as const,valida:true})),...(parto&&partos.some(p=>p.id===parto.id&&["VIVO","NATIMORTO"].includes(p.desfecho))?[{id:parto.id,gestacaoId:g.id,data:texto(parto.data),tipo:"PARTO_QUALIFICANTE" as const,valida:true}]:[])].sort((a,b)=>a.data.localeCompare(b.data)||a.id.localeCompare(b.id));
  const coberturaSeguimento=evidencias.slice(1).flatMap((e,i)=>{const anterior=evidencias[i];return coberturaOperacional(d,g.animalId,dia(anterior.data),dia(e.data))?[{desde:anterior.data,ate:e.data,evidenciaIds:[anterior.id,e.id]}]:[];});
  const tipo=desfechoGestacao(g,d.partos);
  return {id:g.id,animalId:g.animalId,valida:g.status==="VALIDO",confirmadaEm:texto(g.confirmadaEm),localConfirmacao:localNaData(d,g.animalId,g.confirmadaEm),primeiroDgPositivo:positivos[0]?{id:positivos[0].id,data:texto(positivos[0].data),local:localNaData(d,g.animalId,positivos[0].data)}:null,encerramento:g.encerradaEm&&g.encerradaEm<=corte?{tipo:parto&&(parto.desfecho==="ABORTO"||parto.tipo==="ABORTO")?"PERDA" as const:tipo==="ABERTA"?"NAO_IDENTIFICADO" as const:tipo,subtipo:parto&&(parto.desfecho==="ABORTO"||parto.tipo==="ABORTO")?"ABORTO" as const:"PERDA_REGISTRADA" as const,data:texto(g.encerradaEm),fatoId:parto?.id??g.id,explicacao:parto&&(parto.desfecho==="ABORTO"||parto.tipo==="ABORTO")?explicacaoObservacional(parto):g.motivoEncerramento??undefined}:null,coberturaSeguimento,evidencias};
 });
 const concepcoes=d.gestacoes.filter(g=>g.status==="VALIDO"&&g.confirmadaEm<=corte).map(g=>{
  const tentativa=d.tentativas.find(t=>t.id===g.tentativaId);
  const prova=tentativa?classificarTentativaIndicador(tentativa,dados,corte,0):null;
  const evidencias=dados.evidencias.filter(e=>e.gestacaoId===g.id&&e.status==="VALIDO"&&e.resultado==="POSITIVO"&&e.data<=corte);
  return {id:g.id,animalId:g.animalId,tentativaId:g.tentativaId,confirmadaEm:texto(g.confirmadaEm),valida:tentativa?prova?.resultado==="POSITIVA":evidencias.length>0,evidenciaIds:prova?.evidencias.map(e=>e.id)??evidencias.map(e=>e.id),localConfirmacao:localNaData(d,g.animalId,g.confirmadaEm)};
 });
 return {ciclos,gestacoes,partos,concepcoes,pendenciasOrigemCiclo};
}
export function calcularAcompanhamentoDoConjunto(dados:DadosIndicadores,filtros:ConsultaIndicadoresInput){
 const fatos=construirDadosAcompanhamento(dados,filtros),resultado=calcularAcompanhamentoIndicadores(fatos,filtros);
 const motivos=(local:LocalIndicadorAcompanhamento|null)=>[...(local?.propriedadeId==null?["LOCALIZACAO_NAO_COMPROVADA"]:[]),...(filtros.loteId&&local?.loteId==null?["LOTE_NAO_COMPROVADO"]:[]),...(filtros.papeis?.length&&local?.papel==null?["PAPEL_NAO_COMPROVADO"]:[])];
 const exclusoesEscopo=[...resultado.espera.pendenciasEscopo.flatMap(p=>{const c=fatos.ciclos.find(c=>c.id===p.cicloId);return c?[{animalId:c.animalId,populacao:p.populacao==="COORTE"?"COORTE_ESPERA":"FILA_ATUAL",referenciaId:c.id,motivos:motivos(p.populacao==="COORTE"?c.localInicio:c.localCorte)}]:[];}),...resultado.perdas.pendenciasEscopo.flatMap(id=>{const g=fatos.gestacoes.find(g=>g.id===id);return g?[{animalId:g.animalId,populacao:"COORTE_PERDAS",referenciaId:g.id,motivos:motivos(g.primeiroDgPositivo?.local??g.localConfirmacao)}]:[];})];
 return {identificacoes:dados.identificacoes,...resultado,exclusoesEscopo,origemCoberturaSeguimento:"EXAMES_POSITIVOS_MESMA_GESTACAO_OU_PARTO_QUALIFICANTE_COM_CONTINUIDADE_OPERACIONAL" as const};
}
