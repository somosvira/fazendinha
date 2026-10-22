import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { transacaoEstoque } from "../../estoque/transacao.js";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { venderLeiteTx } from "./estoque.js";
import { conferirSaldoComercial, conferirTotaisDemonstrativo } from "./comercial.calc.js";
import { registrarEntregaLeiteSchema, conferirEntregaLeiteSchema, demonstrativoLeiteSchema, anularDemonstrativoLeiteSchema, consultaComercialLeiteSchema, type RegistrarEntregaLeiteInput, type ConferirEntregaLeiteInput, type DemonstrativoLeiteInput } from "./comercial.schemas.js";
import type { z } from "zod";
type Db = Prisma.TransactionClient;
export type ContextoComercialLeite = { propriedadeId: number; usuarioId: number | null };
const D=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
const dia=(v:string)=>new Date(`${v}T00:00:00Z`);
const incluirEntrega = { retirada: { include: { versoesComerciaisLeite: { orderBy: { versao: "desc" }, include: { operacao: { include: { parceiro: { select: { nome: true } } } } } } } }, parceiro: { select: { nome: true } }, conferencias: { orderBy: { versao: "desc" } }, alocacoes: { where: { ativo: true } }, comprovantes: true } as const;
type Entrega = Prisma.EntregaLeiteGetPayload<{include:typeof incluirEntrega}>;
function falha(m:string):never { throw new RebanhoError("CONFLITO",m); }
export async function obterEntregaLeiteTx(tx:Db,id:string,propriedadeId:number) {
  const e=await tx.entregaLeite.findFirst({where:{id,propriedadeId},include:incluirEntrega});
  if(!e) throw new RebanhoError("NAO_ENCONTRADO","Entrega não encontrada neste sítio"); return e;
}
export function entregaLeiteDTO(e:Entrega,verValores:boolean) {
  const c=e.conferencias[0],v=e.retirada.versoesComerciaisLeite[0];
  const q=e.alocacoes.reduce((s,a)=>s.plus(a.quantidade),D(0)),valor=e.alocacoes.reduce((s,a)=>s.plus(a.valor),D(0));
  const max=c.volumeAceito===null?e.retirada.quantidade:Prisma.Decimal.min(c.volumeAceito,e.retirada.quantidade);
  return {id:e.id,propriedadeId:e.propriedadeId,parceiroId:v.operacao.parceiroId,parceiroNome:v.operacao.parceiro?.nome??e.parceiro.nome,retiradaId:e.retiradaId,produtoId:e.retirada.produtoId,data:e.retirada.data.toISOString().slice(0,10),operacaoId:v.operacaoId,numeroOperacao:v.operacao.numero,versaoVendaId:v.id,
    pontoColeta:e.pontoColeta,horarioColeta:e.horarioColeta,referencia:e.referencia,expedidoLitros:e.retirada.quantidade.toString(),volumeAceito:c.volumeAceito?.toString()??null,versao:c.versao,situacao:c.situacao,motivo:c.motivo,destinacaoInformada:c.destinacaoInformada,
    quantidadeFaturada:q.toString(),valorFaturado:verValores?valor.toFixed(2):null,quantidadeDisponivel:c.volumeAceito===null?null:max.minus(q).toString(),limiteExpedidoPendenteLitros:c.volumeAceito===null?e.retirada.quantidade.minus(q).toString():null,valorDisponivel:verValores?v.operacao.valorTotal.minus(valor).toFixed(2):null,
    aceitePendente:c.volumeAceito===null,historico:e.conferencias.map(c=>({versao:c.versao,volumeAceito:c.volumeAceito?.toString()??null,situacao:c.situacao,motivo:c.motivo,destinacaoInformada:c.destinacaoInformada,criadoEm:c.criadoEm.toISOString(),criadoPorId:c.criadoPorId})),
    comprovantes:e.comprovantes.map(c=>({id:c.id,nome:c.nome,mimeType:c.mimeType,tamanhoBytes:c.tamanhoBytes,criadoEm:c.criadoEm.toISOString()}))};
}
async function travarEntregaTx(tx:Db,id:string,ctx:ContextoComercialLeite) {
  const ref=await obterEntregaLeiteTx(tx,id,ctx.propriedadeId);
  await travarValorizacaoTx(tx,[ref.retirada.produtoId]);
  await tx.$queryRaw`SELECT id FROM pecuaria."EntregaLeite" WHERE id=${id} AND "propriedadeId"=${ctx.propriedadeId} FOR NO KEY UPDATE`;
  return obterEntregaLeiteTx(tx,id,ctx.propriedadeId);
}
export async function registrarEntregaLeiteTx(tx:Db,raw:RegistrarEntregaLeiteInput,ctx:ContextoComercialLeite) {
  const input=registrarEntregaLeiteSchema.parse(raw);
  return operacaoIdempotenteTx(tx,{...input,propriedadeId:ctx.propriedadeId},ctx.usuarioId,"ENTREGA_LEITE_REGISTRAR",async()=>{
    const operacaoId=input.vinculo.tipo==="NOVA_VENDA"?(await venderLeiteTx(tx,{...input.vinculo.venda,chave:input.chave},ctx)).id:input.vinculo.operacaoId;
    const ref=await tx.versaoComercialVendaLeite.findFirst({where:{operacaoId,operacao:{propriedadeId:ctx.propriedadeId,status:"CONFIRMADA"}},include:{retirada:true,operacao:true}});
    if(!ref) falha("Venda sem retirada leiteira comprovada neste sítio; histórico V1 exige reconciliação explícita, sem conversão automática");
    await travarValorizacaoTx(tx,[ref.retirada.produtoId]);
    await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${operacaoId} FOR NO KEY UPDATE`;
    const v=await tx.versaoComercialVendaLeite.findFirst({where:{id:ref.id,operacao:{status:"CONFIRMADA",propriedadeId:ctx.propriedadeId}},include:{operacao:true,retirada:true}});
    if(!v||v.retirada.status!=="CONFIRMADO"||!v.operacao.parceiroId) falha("Venda mudou ou não possui comprador; atualize antes de vincular");
    if(await tx.entregaLeite.findUnique({where:{retiradaId:v.retiradaId}})) falha("Esta retirada já possui entrega; consulte o registro existente");
    if(v.retirada.data>hojeFazendaDate()) falha("Entrega futura não pode ser confirmada");
    await exigirPeriodoAberto(tx,ctx.propriedadeId,v.retirada.data);
    const e=await tx.entregaLeite.create({data:{propriedadeId:ctx.propriedadeId,parceiroId:v.operacao.parceiroId,retiradaId:v.retiradaId,pontoColeta:input.pontoColeta,horarioColeta:input.horarioColeta,referencia:input.referencia,criadoPorId:ctx.usuarioId,
      conferencias:{create:{versao:1,volumeAceito:input.volumeAceito===null?null:D(input.volumeAceito),situacao:input.situacao,motivo:input.motivo,destinacaoInformada:input.destinacaoInformada,criadoPorId:ctx.usuarioId}}}});
    await auditar(tx,{entidade:"EntregaLeite",entidadeId:e.id,propriedadeId:ctx.propriedadeId,usuarioId:ctx.usuarioId,acao:"REGISTRO",depois:{...e,conferencia:input}});
    return {id:e.id,operacaoId:v.operacaoId,retiradaId:v.retiradaId};
  });
}
export const registrarEntregaLeite=(input:RegistrarEntregaLeiteInput,ctx:ContextoComercialLeite)=>transacaoEstoque(tx=>registrarEntregaLeiteTx(tx,input,ctx));
export async function conferirEntregaLeite(id:string,raw:ConferirEntregaLeiteInput,ctx:ContextoComercialLeite) {
  const input=conferirEntregaLeiteSchema.parse(raw);
  return transacaoEstoque(tx=>operacaoIdempotenteTx(tx,{...input,entregaId:id,propriedadeId:ctx.propriedadeId},ctx.usuarioId,"ENTREGA_LEITE_CONFERIR",async()=>{
    const e=await travarEntregaTx(tx,id,ctx),c=e.conferencias[0];
    if(c.versao!==input.versaoEsperada) falha("Conferência mudou; atualize a entrega");
    await exigirPeriodoAberto(tx,ctx.propriedadeId,e.retirada.data); await exigirPeriodoAberto(tx,ctx.propriedadeId,new Date());
    if(e.alocacoes.length) falha("Anule os demonstrativos ativos antes de revisar o aceite ou a destinação da entrega");
    const novo=await tx.conferenciaEntregaLeite.create({data:{entregaId:id,versao:c.versao+1,volumeAceito:input.volumeAceito===null?null:D(input.volumeAceito),situacao:input.situacao,motivo:input.motivo,destinacaoInformada:input.destinacaoInformada,criadoPorId:ctx.usuarioId}});
    await auditar(tx,{entidade:"EntregaLeite",entidadeId:id,propriedadeId:ctx.propriedadeId,usuarioId:ctx.usuarioId,acao:"CONFERENCIA",antes:c,depois:novo}); return {id,versao:novo.versao};
  }));
}
export async function registrarDemonstrativoLeiteTx(tx:Db,raw:DemonstrativoLeiteInput,ctx:ContextoComercialLeite) {
  const input=demonstrativoLeiteSchema.parse(raw);
  return operacaoIdempotenteTx(tx,{...input,propriedadeId:ctx.propriedadeId},ctx.usuarioId,"DEMONSTRATIVO_LEITE_REGISTRAR",async()=>{
    try{conferirTotaisDemonstrativo(input.volumeReconhecido,input.valorComercial,input.alocacoes);}catch(e){falha((e as Error).message);}
    if(dia(input.fim)>hojeFazendaDate()) falha("Período do demonstrativo não pode terminar no futuro");
    await exigirPeriodoAberto(tx,ctx.propriedadeId,dia(input.inicio)); await exigirPeriodoAberto(tx,ctx.propriedadeId,dia(input.fim)); await exigirPeriodoAberto(tx,ctx.propriedadeId,new Date());
    // Ordem global de produtos e entregas evita travas opostas entre demonstrativos.
    const refs=await tx.entregaLeite.findMany({where:{id:{in:input.alocacoes.map(a=>a.entregaId)},propriedadeId:ctx.propriedadeId},select:{retirada:{select:{produtoId:true}}}});
    await travarValorizacaoTx(tx,refs.map(e=>e.retirada.produtoId));
    const parcelas=[];
    for(const a of [...input.alocacoes].sort((x,y)=>x.entregaId.localeCompare(y.entregaId))) {
      const e=await travarEntregaTx(tx,a.entregaId,ctx),c=e.conferencias[0],v=e.retirada.versoesComerciaisLeite[0];
      if(c.versao!==a.versaoEsperadaEntrega||v.id!==a.versaoVendaId||v.operacao.status!=="CONFIRMADA") falha("Entrega ou versão comercial mudou; confira novamente");
      if(v.operacao.parceiroId!==input.parceiroId) falha("Comprador do demonstrativo diverge da entrega/venda vigente");
      if(e.retirada.data<dia(input.inicio)||e.retirada.data>dia(input.fim)) falha("Entrega fora do período comercial declarado");
      await exigirPeriodoAberto(tx,ctx.propriedadeId,e.retirada.data);
      try{conferirSaldoComercial({expedido:e.retirada.quantidade,aceito:c.volumeAceito,valorVenda:v.operacao.valorTotal,quantidadeAlocada:e.alocacoes.reduce((s,a)=>s.plus(a.quantidade),D(0)),valorAlocado:e.alocacoes.reduce((s,a)=>s.plus(a.valor),D(0)),quantidade:a.quantidadeLitros,valor:a.valor,motivoAceitePendente:a.motivoAceitePendente});}catch(erro){falha((erro as Error).message);}
      parcelas.push({entregaId:e.id,versaoVendaId:v.id,quantidade:D(a.quantidadeLitros),valor:D(a.valor),motivoAceitePendente:a.motivoAceitePendente});
    }
    const doc=await tx.demonstrativoLeite.create({data:{propriedadeId:ctx.propriedadeId,parceiroId:input.parceiroId,inicio:dia(input.inicio),fim:dia(input.fim),referencia:input.referencia,precoBase:D(input.precoBase),volumeReconhecido:D(input.volumeReconhecido),valorComercial:D(input.valorComercial),valorPagamentoInformado:input.valorPagamentoInformado===null?null:D(input.valorPagamentoInformado),componentes:input.componentes,criadoPorId:ctx.usuarioId,alocacoes:{create:parcelas}}});
    await auditar(tx,{entidade:"DemonstrativoLeite",entidadeId:doc.id,propriedadeId:ctx.propriedadeId,usuarioId:ctx.usuarioId,acao:"REGISTRO",depois:{...doc,alocacoes:parcelas}}); return {id:doc.id,versao:doc.versao};
  });
}
export const registrarDemonstrativoLeite=(input:DemonstrativoLeiteInput,ctx:ContextoComercialLeite)=>transacaoEstoque(tx=>registrarDemonstrativoLeiteTx(tx,input,ctx));
export async function anularDemonstrativoLeite(id:string,raw:z.infer<typeof anularDemonstrativoLeiteSchema>,ctx:ContextoComercialLeite) {
 const input=anularDemonstrativoLeiteSchema.parse(raw);return transacaoEstoque(tx=>operacaoIdempotenteTx(tx,{...input,id,propriedadeId:ctx.propriedadeId},ctx.usuarioId,"DEMONSTRATIVO_LEITE_ANULAR",async()=>{
  const ref=await tx.demonstrativoLeite.findFirst({where:{id,propriedadeId:ctx.propriedadeId},include:{alocacoes:{include:{entrega:{include:{retirada:true}}}}}});if(!ref) throw new RebanhoError("NAO_ENCONTRADO","Demonstrativo não encontrado");
  await travarValorizacaoTx(tx,ref.alocacoes.map(a=>a.entrega.retirada.produtoId)); await tx.$queryRaw`SELECT id FROM pecuaria."DemonstrativoLeite" WHERE id=${id} FOR NO KEY UPDATE`;
  const d=await tx.demonstrativoLeite.findUniqueOrThrow({where:{id}}); if(d.status!=="VALIDO"||d.versao!==input.versaoEsperada) falha("Demonstrativo mudou ou já foi anulado");
  await exigirPeriodoAberto(tx,ctx.propriedadeId,d.inicio);await exigirPeriodoAberto(tx,ctx.propriedadeId,d.fim);await exigirPeriodoAberto(tx,ctx.propriedadeId,new Date());
  for(const a of ref.alocacoes) await exigirPeriodoAberto(tx,ctx.propriedadeId,a.entrega.retirada.data);
  await tx.alocacaoDemonstrativoLeite.updateMany({where:{demonstrativoId:id,ativo:true},data:{ativo:false}});
  await tx.demonstrativoLeite.update({where:{id},data:{status:"ANULADO",versao:{increment:1},motivoAnulacao:input.motivo,anuladoEm:new Date()}});
  await auditar(tx,{entidade:"DemonstrativoLeite",entidadeId:id,propriedadeId:ctx.propriedadeId,usuarioId:ctx.usuarioId,acao:"ANULACAO",antes:d,depois:{motivo:input.motivo}});return {id,versao:d.versao+1};
 }));
}
export async function consultarEntregasLeite(raw:z.infer<typeof consultaComercialLeiteSchema>,ctx:ContextoComercialLeite,verValores:boolean) {
 const f=consultaComercialLeiteSchema.parse(raw);const where:Prisma.EntregaLeiteWhereInput={propriedadeId:ctx.propriedadeId,...(f.parceiroId?{retirada:{versoesComerciaisLeite:{some:{operacao:{status:"CONFIRMADA",parceiroId:f.parceiroId}}}}}:{}),...(f.de||f.ate?{AND:[{retirada:{data:{...(f.de?{gte:dia(f.de)}:{}),...(f.ate?{lte:dia(f.ate)}:{})}}}]}:{})};
 return prisma.$transaction(async tx=>{const[total,itens]=await Promise.all([tx.entregaLeite.count({where}),tx.entregaLeite.findMany({where,include:incluirEntrega,orderBy:[{criadoEm:"desc"},{id:"desc"}],skip:(f.pagina-1)*f.porPagina,take:f.porPagina})]);return{propriedadeId:ctx.propriedadeId,total,pagina:f.pagina,porPagina:f.porPagina,itens:itens.map(e=>entregaLeiteDTO(e,verValores))};},{isolationLevel:"RepeatableRead"});
}
export async function consultarDemonstrativosLeite(raw:z.infer<typeof consultaComercialLeiteSchema>,ctx:ContextoComercialLeite) {
 const f=consultaComercialLeiteSchema.parse(raw);const where:Prisma.DemonstrativoLeiteWhereInput={propriedadeId:ctx.propriedadeId,...(f.parceiroId?{parceiroId:f.parceiroId}:{}),...(f.de?{fim:{gte:dia(f.de)}}:{}),...(f.ate?{inicio:{lte:dia(f.ate)}}:{})};
 return prisma.$transaction(async tx=>{const[total,itens]=await Promise.all([tx.demonstrativoLeite.count({where}),tx.demonstrativoLeite.findMany({where,include:{alocacoes:true},orderBy:[{criadoEm:"desc"},{id:"desc"}],skip:(f.pagina-1)*f.porPagina,take:f.porPagina})]);return{propriedadeId:ctx.propriedadeId,total,pagina:f.pagina,porPagina:f.porPagina,itens:itens.map(d=>({...d,precoBase:d.precoBase.toFixed(4),volumeReconhecido:d.volumeReconhecido.toString(),valorComercial:d.valorComercial.toFixed(2),valorPagamentoInformado:d.valorPagamentoInformado?.toFixed(2)??null,alocacoes:d.alocacoes.map(a=>({...a,quantidade:a.quantidade.toString(),valor:a.valor.toFixed(2)}))}))};},{isolationLevel:"RepeatableRead"});
}

/** Não converte V1: mostra o impedimento para reconciliação humana explícita. */
export async function consultarVendasVinculaveisLeite(raw:z.infer<typeof consultaComercialLeiteSchema>,ctx:ContextoComercialLeite,verValores=false) {
 const f=consultaComercialLeiteSchema.parse(raw);const where:Prisma.OperacaoWhereInput={propriedadeId:ctx.propriedadeId,tipo:"VENDA",status:"CONFIRMADA",...(f.parceiroId?{parceiroId:f.parceiroId}:{}),...(f.de||f.ate?{data:{...(f.de?{gte:dia(f.de)}:{}),...(f.ate?{lte:dia(f.ate)}:{})}}:{})};
 return prisma.$transaction(async tx=>{const[total,itens]=await Promise.all([tx.operacao.count({where}),tx.operacao.findMany({where,include:{parceiro:{select:{nome:true}},itens:true,versaoComercialLeite:{include:{retirada:{include:{entregaLeite:{select:{id:true}}}}}}},orderBy:[{data:"desc"},{numero:"desc"}],skip:(f.pagina-1)*f.porPagina,take:f.porPagina})]);return{propriedadeId:ctx.propriedadeId,total,pagina:f.pagina,porPagina:f.porPagina,itens:itens.map(o=>{const v=o.versaoComercialLeite;const impedimento=!v?"VENDA sem retirada leiteira comprovada; exige reconciliação de histórico V1, sem conversão automática":v.retirada.entregaLeite?"Retirada já vinculada a uma entrega":v.retirada.status!=="CONFIRMADO"?"Retirada não confirmada":!o.parceiroId?"Venda sem comprador":null;return{operacaoId:o.id,numero:o.numero,data:o.data.toISOString().slice(0,10),parceiroId:o.parceiroId,parceiroNome:o.parceiro?.nome??null,valorTotal:verValores?o.valorTotal.toFixed(2):null,retiradaId:v?.retiradaId??null,produtoId:v?.retirada.produtoId??null,quantidadeLitros:v?.retirada.quantidade.toString()??null,podeVincular:impedimento===null,impedimento};})};},{isolationLevel:"RepeatableRead"});
}
