import { Prisma } from "@prisma/client";
import { z } from "zod";
import { RebanhoError } from "../rebanho/regras.js";
import { execucaoProtocoloSchema, type ItemExecucaoProtocolo } from "../protocolos/execucao.schemas.js";
import { prepararExecucaoProtocoloTx, travarOrigensExecucaoProtocoloTx, executarItensPreparadosProtocoloTx } from "../protocolos/execucao.js";
import { lerDataIatf } from "./horarios.calc.js";
import { obterSaldo } from "../consumo.js";
import { totalAtribuidoServicoTx } from "./atribuicoes-servico.js";
import { dinheiro } from "../../financeiro/regras.js";
import { hashDados } from "./operacoes.js";

type Tx=Prisma.TransactionClient;
export type LinhaProtocoloVisita={participanteId:string;animalId:string;tarefaId:string;dados:Record<string,unknown>};
type TarefaAdapter={id:string;etapaId:string;etapa:{tipo:string;configuracao:unknown};execucaoId:string;execucao:{rodadaId:string|null;animalId:string;propriedadeId:number|null}};

/** Lê o envelope salvo pela visita; o tipo efetivo vem da tarefa, nunca do texto enviado. */
export function itemProtocoloDaVisita(atividadeTipo:string,linha:LinhaProtocoloVisita,tarefa:TarefaAdapter,propriedadeId:number,dataVisita:string):ItemExecucaoProtocolo{
 const config=tarefa.etapa.configuracao&&typeof tarefa.etapa.configuracao==="object"&&!Array.isArray(tarefa.etapa.configuracao)?tarefa.etapa.configuracao:{};
 const tipo="tipo" in config&&config.tipo==="AVALIACAO"?"AVALIACAO":tarefa.etapa.tipo;
 const bruto=linha.dados;
 const envelope=atividadeTipo==="TAREFA_IATF";
 const internos=envelope?z.record(z.unknown()).parse(bruto.dados??{}):bruto;
 if(envelope&&typeof bruto.realizadaEm!=="string")throw new RebanhoError("VALIDACAO","Informe a data da execução","realizadaEm");
 if(internos.animalId!=null&&internos.animalId!==linha.animalId||internos.propriedadeId!=null&&internos.propriedadeId!==propriedadeId||internos.tarefaId!=null&&internos.tarefaId!==tarefa.id)
  throw new RebanhoError("VALIDACAO","Os dados não pertencem à tarefa, animal ou sítio da visita");
 const {chave:_chave,tipo:tipoInterno,...campos}=internos;
 if(tipo!=="TENTATIVA"&&tipoInterno!=null&&tipoInterno!==tipo)throw new RebanhoError("VALIDACAO","O procedimento informado diverge da ação planejada","tipo");
 const realizada=envelope?String(bruto.realizadaEm):typeof internos.aplicadaEm==="string"?internos.aplicadaEm:typeof internos.realizadaEm==="string"?internos.realizadaEm:typeof internos.data==="string"?internos.data:dataVisita;
 const temporal=lerDataIatf(realizada);
 const item:Record<string,unknown>={...campos,tipo,tarefaId:tarefa.id,animalId:linha.animalId,propriedadeId,data:temporal.data,
  ...(envelope&&typeof bruto.motivo==="string"?{desvio:{motivo:bruto.motivo}}:{}),
  ...(envelope&&bruto.cienciaRecalendarioLegado===true?{cienciaRecalendarioLegado:true}:{})};
 if(tipo==="APLICACAO"){
  delete item.realizadaEm;
  if(temporal.precisao==="HORA")item.aplicadaEm=realizada;
  else delete item.aplicadaEm;
 }else item.realizadaEm=realizada;
 if(tipo==="TENTATIVA")item.tipoTentativa=tipoInterno;
 const input=execucaoProtocoloSchema.parse({versao:1,propriedadeId,itens:[item]});
 return input.itens[0];
}

/** Todas as origens são travadas antes dos grupos; a visita continua uma única transação. */
export async function prepararProtocolosVisitaTx(tx:Tx,atividadeTipo:string,linhas:LinhaProtocoloVisita[],propriedadeId:number,dataVisita:string){
 if(!linhas.length)return null;
 const tarefas=await tx.tarefaProtocolo.findMany({where:{id:{in:linhas.map(l=>l.tarefaId)}},include:{etapa:true,execucao:true}});
 if(tarefas.length!==linhas.length||tarefas.some(t=>t.execucao.propriedadeId!==propriedadeId||!linhas.some(l=>l.tarefaId===t.id&&l.animalId===t.execucao.animalId)))
  throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada para o animal e sítio da visita");
 const mapeados=linhas.map(l=>({participanteId:l.participanteId,item:itemProtocoloDaVisita(atividadeTipo,l,tarefas.find(t=>t.id===l.tarefaId)!,propriedadeId,dataVisita)}));
 await travarOrigensExecucaoProtocoloTx(tx,mapeados.map(m=>m.item));
 const grupos=new Map<string,ItemExecucaoProtocolo[]>();
 for(const {item} of mapeados){const t=tarefas.find(t=>t.id===item.tarefaId)!;const chave=`${t.etapaId}:${t.execucao.rodadaId??t.execucaoId}`;grupos.set(chave,[...(grupos.get(chave)??[]),item]);}
 const preparados=[];
 for(const [grupo,itens] of [...grupos].sort(([a],[b])=>a.localeCompare(b))){
  const preparada=await prepararExecucaoProtocoloTx(tx,{versao:1,propriedadeId,itens});
  if(preparada.itens.some(i=>i.motivoObrigatorio&&!i.motivo))throw new RebanhoError("VALIDACAO","Explique os desvios da tarefa antes de confirmar a visita","motivo");
  preparados.push({grupo,preparada});
 }
 // A mesma origem pode aparecer em ações diferentes da visita; o saldo precisa cobrir todas.
 const consumos=preparados.flatMap(p=>p.preparada.consumos);
 const produtos=new Map<string,Prisma.Decimal>(),lotes=new Map<string,{produtoId:string;partidaId:string;quantidade:Prisma.Decimal}>(),compras=new Map<string,Prisma.Decimal>();
 for(const c of consumos){
  if(c.itemCompraDiretaId){compras.set(c.itemCompraDiretaId,(compras.get(c.itemCompraDiretaId)??new Prisma.Decimal(0)).plus(c.quantidade));continue;}
  produtos.set(c.produtoId,(produtos.get(c.produtoId)??new Prisma.Decimal(0)).plus(c.quantidade));
  if(c.partidaId){const chave=`${c.produtoId}:${c.partidaId}`;lotes.set(chave,{produtoId:c.produtoId,partidaId:c.partidaId,quantidade:(lotes.get(chave)?.quantidade??new Prisma.Decimal(0)).plus(c.quantidade)});}
 }
 for(const [produtoId,q] of produtos)if((await obterSaldo(tx,produtoId,propriedadeId)).lt(q))throw new RebanhoError("VALIDACAO","Saldo insuficiente para todas as ações selecionadas na visita","quantidade");
 for(const c of lotes.values())if((await obterSaldo(tx,c.produtoId,propriedadeId,c.partidaId)).lt(c.quantidade))throw new RebanhoError("VALIDACAO","Saldo do lote insuficiente para todas as ações da visita","partidaId");
 for(const [id,q] of compras){const compra=await tx.itemOperacao.findUniqueOrThrow({where:{id}});const usadas=await tx.aplicacaoProduto.aggregate({where:{itemCompraDiretaId:id,status:"VALIDO"},_sum:{quantidadeCompraDireta:true}});if(q.plus(usadas._sum.quantidadeCompraDireta??0).gt(compra.quantidade))throw new RebanhoError("VALIDACAO","A compra direta não cobre todas as ações da visita","itemCompraDiretaId");}
 const servicos=new Map<string,Prisma.Decimal>();
 for(const {item} of mapeados)if("valorServicoAtribuido" in item&&item.valorServicoAtribuido!=null&&item.operacaoServicoId)servicos.set(item.operacaoServicoId,(servicos.get(item.operacaoServicoId)??new Prisma.Decimal(0)).plus(dinheiro(item.valorServicoAtribuido)));
 for(const [id,valor] of servicos){const servico=await tx.operacao.findUniqueOrThrow({where:{id}});if(valor.plus(await totalAtribuidoServicoTx(tx,id,propriedadeId)).gt(servico.valorTotal))throw new RebanhoError("VALIDACAO","A atribuição das ações da visita supera o Serviço","valorServicoAtribuido");}
 return {mapeados,preparados,consumos,fingerprint:hashDados(preparados.map(p=>({grupo:p.grupo,fingerprint:p.preparada.fingerprint})))};
}
export async function executarProtocolosVisitaTx(tx:Tx,preparacao:Awaited<ReturnType<typeof prepararProtocolosVisitaTx>>,usuarioId:number|null){
 const fatos=new Map<string,{id:string;tipo:ItemExecucaoProtocolo["tipo"];tarefaId:string}>();
 if(!preparacao)return fatos;
 for(const grupo of preparacao.preparados){const realizados=await executarItensPreparadosProtocoloTx(tx,grupo.preparada,usuarioId);for(const f of realizados){const linha=preparacao.mapeados.find(m=>m.item.tarefaId===f.tarefaId)!;fatos.set(linha.participanteId,f);}}
 return fatos;
}
