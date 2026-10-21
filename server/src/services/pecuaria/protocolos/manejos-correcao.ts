import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError,auditar,travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { marcarRegularizacaoFatoTx } from "../reproducao/marcacao-regularizacao.js";
import { regularizacaoSchema } from "../reproducao/schemas.js";
import { regularizarTarefaComumTx } from "./regularizacao.js";
import { executarExecucaoManejoTx } from "./execucao.manejos.js";
import { anularManejoProtocoloSchema,itemExecucaoManejoSchema } from "./execucao.manejos.schemas.js";

export async function anularManejoProtocolarTx(tx:Prisma.TransactionClient,id:string,input:z.infer<typeof anularManejoProtocoloSchema>,usuarioId:number|null){
  const ref=await tx.manejoAnimal.findFirst({where:{id,propriedadeId:input.propriedadeId,tipo:{in:["PROTOCOLAR","RETIRADA_DISPOSITIVO"]}}});
  if(!ref)throw new RebanhoError("NAO_ENCONTRADO","Manejo protocolar não encontrado neste sítio");
  await travarAnimais(tx,[ref.animalId]);
  const antes=await tx.manejoAnimal.findUniqueOrThrow({where:{id}});
  if(antes.status!=="VALIDO")throw new RebanhoError("CONFLITO","Manejo já anulado");
  if(!input.realizacaoMantida&&!input.cienciaNaoExecutado)throw new RebanhoError("VALIDACAO","Confirme que o manejo não foi realizado para liberar repetição","cienciaNaoExecutado");
  if(antes.operacaoServicoId)await exigirPeriodoAberto(tx,input.propriedadeId,antes.data);
  await tx.manejoAnimal.update({where:{id},data:{status:"ANULADO",anuladoEm:new Date(),motivoAnulacao:input.motivo,realizacaoMantida:input.realizacaoMantida}});
  await marcarRegularizacaoFatoTx(tx,{fatoTipo:"MANEJO",fatoId:id,destinoConsumo:input.realizacaoMantida?"MANTER_CONSUMO":null,motivo:input.motivo,usuarioId});
  await auditar(tx,{entidade:"ManejoAnimal",entidadeId:id,animalId:antes.animalId,propriedadeId:input.propriedadeId,acao:"ANULACAO",usuarioId,antes,depois:{status:"ANULADO",realizacaoMantida:input.realizacaoMantida,motivo:input.motivo}});
  return{id,status:"ANULADO" as const,animalId:antes.animalId};
}
export function anularManejoProtocolar(id:string,entrada:unknown,usuarioId:number|null){
  const input=anularManejoProtocoloSchema.parse(entrada);
  return transacaoPecuaria(async tx=>{const ref=await tx.manejoAnimal.findFirst({where:{id,propriedadeId:input.propriedadeId}});if(!ref)throw new RebanhoError("NAO_ENCONTRADO","Manejo não encontrado");await travarAnimais(tx,[ref.animalId]);return operacaoIdempotenteTx(tx,{...input,manejoId:id},usuarioId,"ANULACAO_MANEJO_PROTOCOLO",()=>anularManejoProtocolarTx(tx,id,input,usuarioId));});
}
export const corrigirManejoProtocoloSchema=z.object({chave:z.string().uuid(),propriedadeId:z.number().int().positive(),motivo:z.string().trim().min(5).max(1000),item:itemExecucaoManejoSchema}).strict();
export function corrigirManejoProtocolar(id:string,entrada:unknown,usuarioId:number|null){
  const input=corrigirManejoProtocoloSchema.parse(entrada);
  return transacaoPecuaria(async tx=>{
    const ref=await tx.manejoAnimal.findFirst({where:{id,propriedadeId:input.propriedadeId,tarefaId:input.item.tarefaId}});
    if(!ref)throw new RebanhoError("NAO_ENCONTRADO","Manejo não encontrado para correção");
    await travarAnimais(tx,[ref.animalId]);
    return operacaoIdempotenteTx(tx,{...input,manejoId:id},usuarioId,"CORRECAO_MANEJO_PROTOCOLO",async()=>{
      const antes=await tx.manejoAnimal.findUniqueOrThrow({where:{id}});
      if(antes.status!=="VALIDO"||antes.animalId!==input.item.animalId||input.item.propriedadeId!==input.propriedadeId||(antes.tipo==="RETIRADA_DISPOSITIVO")!==(input.item.tipo==="RETIRADA"))throw new RebanhoError("CONFLITO","Correção deve preservar animal, sítio, ação e tarefa");
      if(antes.operacaoServicoId)await exigirPeriodoAberto(tx,input.propriedadeId,antes.data);
      const tarefa=await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:input.item.tarefaId}});
      // Substituição documental atômica: o fato anterior permanece, não há nova
      // retirada física, aplicação ou consumo. A nova evidência retifica o fato.
      await tx.manejoAnimal.update({where:{id},data:{status:"ANULADO",anuladoEm:new Date(),motivoAnulacao:input.motivo,realizacaoMantida:false}});
      await tx.vinculoTarefaProtocolo.updateMany({where:{manejoId:id,estado:"ATUAL"},data:{estado:"SUBSTITUIDO",encerradoEm:new Date(),motivo:input.motivo}});
      await tx.tarefaProtocolo.update({where:{id:tarefa.id},data:{realizadaEm:null,precisaoRealizacao:null,regularizacaoPendente:false}});
      const item={...input.item,...(input.item.valorServicoAtribuido===undefined&&antes.valorServicoAtribuido!=null&&(!input.item.operacaoServicoId||input.item.operacaoServicoId===antes.operacaoServicoId)?{valorServicoAtribuido:antes.valorServicoAtribuido.toFixed(2)}:{})};
      const criada=await executarExecucaoManejoTx(tx,item,usuarioId);
      const visitas=await tx.participanteVisita.findMany({where:{status:"CONFIRMADO",OR:[{tarefaId:tarefa.id},{fatoTipo:"ManejoAnimal",fatoId:id},{fatoTipo:"TarefaIatf",fatoId:tarefa.id}]}});
      for(const v of visitas)await tx.participanteVisita.update({where:{id:v.id},data:{...(v.fatoTipo==="ManejoAnimal"?{fatoId:criada.id}:{}),historicoRegularizacao:JSON.parse(JSON.stringify([...(Array.isArray(v.historicoRegularizacao)?v.historicoRegularizacao:[]),{acao:"FATO_CORRIGIDO",anteriorId:id,substitutoId:criada.id,motivo:input.motivo,usuarioId,registradoEm:new Date().toISOString()}]))}});
      await tx.tarefaProtocolo.update({where:{id:tarefa.id},data:{historicoRegularizacao:JSON.parse(JSON.stringify([...(Array.isArray(tarefa.historicoRegularizacao)?tarefa.historicoRegularizacao:[]),{acao:"FATO_CORRIGIDO",anterior:antes,fatoSubstitutoId:criada.id,motivo:input.motivo,usuarioId,registradoEm:new Date().toISOString()}]))}});
      await auditar(tx,{entidade:"ManejoAnimal",entidadeId:id,animalId:antes.animalId,propriedadeId:input.propriedadeId,acao:"CORRECAO_POR_SUBSTITUICAO",usuarioId,antes,depois:{substitutoId:criada.id,motivo:input.motivo}});
      return criada;
    });
  });
}
export function regularizarManejoProtocolar(tarefaId:string,entrada:unknown,usuarioId:number|null){
  const input=regularizacaoSchema.parse(entrada);
  return transacaoPecuaria(async tx=>{const ref=await tx.tarefaProtocolo.findFirst({where:{id:tarefaId,etapa:{tipo:{in:["MANEJO","RETIRADA"]}},execucao:{propriedadeId:input.propriedadeId}}});if(!ref)throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada");const p=await tx.participacaoProtocolo.findUniqueOrThrow({where:{id:ref.execucaoId}});await travarAnimais(tx,[p.animalId]);return operacaoIdempotenteTx(tx,{...input,tarefaId},usuarioId,"REGULARIZACAO_MANEJO_PROTOCOLO",async()=>{await regularizarTarefaComumTx(tx,tarefaId,input,usuarioId);return{id:tarefaId};});});
}
export async function obterManejoProtocolar(id:string,propriedadeId:number){
 const m=await prisma.manejoAnimal.findFirst({where:{id,propriedadeId},select:{id:true,animalId:true,tarefaId:true,tipo:true,data:true,realizadaEm:true,precisaoTemporal:true,responsavel:true,observacao:true,status:true,motivoAnulacao:true,realizacaoMantida:true,insercaoAplicacaoId:true,operacaoServicoId:true,criadoPorId:true}});
 if(!m)throw new RebanhoError("NAO_ENCONTRADO","Manejo não encontrado neste sítio");return m;
}

export async function listarManejosProtocolosAnimal(animalId:string,propriedadeId:number,pagina:number){
 const where:Prisma.ManejoAnimalWhereInput={animalId,propriedadeId,tipo:{in:["PROTOCOLAR","RETIRADA_DISPOSITIVO"]}};
 const total=await prisma.manejoAnimal.count({where});pagina=Math.min(pagina,Math.max(1,Math.ceil(total/10)));
 const itens=await prisma.manejoAnimal.findMany({where,select:{id:true,tipo:true,data:true,realizadaEm:true,precisaoTemporal:true,status:true,tarefaId:true},orderBy:[{data:"desc"},{id:"asc"}],skip:(pagina-1)*10,take:10});return{itens,total,pagina,porPagina:10};
}

export const reconhecerInsercaoSchema=z.object({chave:z.string().uuid(),propriedadeId:z.number().int().positive(),aplicacaoId:z.string().uuid(),motivo:z.string().trim().min(5).max(1000),evidencia:z.string().trim().min(5).max(1000),cienciaSemNovaBaixa:z.literal(true)}).strict();
/** Reconhece somente a natureza do fato existente; nenhuma aplicação ou baixa é recriada. */
export function reconhecerInsercaoDispositivo(tarefaId:string,entrada:unknown,usuarioId:number|null){
 const input=reconhecerInsercaoSchema.parse(entrada);
 return transacaoPecuaria(async tx=>{const tarefa=await tx.tarefaProtocolo.findFirst({where:{id:tarefaId,etapa:{tipo:"RETIRADA"},execucao:{propriedadeId:input.propriedadeId}},include:{execucao:true}});if(!tarefa)throw new RebanhoError("NAO_ENCONTRADO","Tarefa de retirada não encontrada neste sítio");await travarAnimais(tx,[tarefa.execucao.animalId]);return operacaoIdempotenteTx(tx,{...input,tarefaId},usuarioId,"RECONHECER_INSERCAO_DISPOSITIVO",async()=>{
  const antes=await tx.aplicacaoProduto.findFirst({where:{id:input.aplicacaoId,animalId:tarefa.execucao.animalId,propriedadeId:input.propriedadeId,status:"VALIDO"}});
  if(!antes)throw new RebanhoError("VALIDACAO","Selecione aplicação válida do mesmo animal e sítio","aplicacaoId");if(antes.insercaoDispositivoSnapshot)throw new RebanhoError("CONFLITO","A inserção já foi reconhecida; seu registro é histórico");
  const snapshot={versao:1,motivo:input.motivo,evidencia:input.evidencia,usuarioId,registradoEm:new Date().toISOString()};
  await tx.aplicacaoProduto.update({where:{id:antes.id},data:{insercaoDispositivoSnapshot:snapshot}});
  await auditar(tx,{entidade:"AplicacaoProduto",entidadeId:antes.id,animalId:antes.animalId,propriedadeId:input.propriedadeId,acao:"RECONHECIMENTO_INSERCAO",usuarioId,antes:{insercaoDispositivoSnapshot:antes.insercaoDispositivoSnapshot},depois:snapshot});return{id:antes.id};
 });});
}
export async function listarAplicacoesReconhecerInsercao(tarefaId:string,propriedadeId:number,pagina:number){
 const t=await prisma.tarefaProtocolo.findFirst({where:{id:tarefaId,etapa:{tipo:"RETIRADA"},execucao:{propriedadeId}},select:{execucao:{select:{animalId:true}}}});if(!t)throw new RebanhoError("NAO_ENCONTRADO","Tarefa de retirada não encontrada");
 const where:Prisma.AplicacaoProdutoWhereInput={animalId:t.execucao.animalId,propriedadeId,status:"VALIDO",insercaoDispositivoSnapshot:{equals:Prisma.DbNull},retiradasDispositivo:{none:{OR:[{status:"VALIDO"},{realizacaoMantida:true}]}}};
 const total=await prisma.aplicacaoProduto.count({where});pagina=Math.min(pagina,Math.max(1,Math.ceil(total/10)));const itens=await prisma.aplicacaoProduto.findMany({where,select:{id:true,data:true,nomeProdutoAplicado:true},orderBy:[{data:"desc"},{id:"asc"}],skip:(pagina-1)*10,take:10});return{itens,total,pagina,porPagina:10};
}
