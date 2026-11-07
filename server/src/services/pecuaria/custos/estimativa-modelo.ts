import { Prisma, type UnidadeMedida } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { saldosBasesTx } from "../../estoque/valorizacao.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { referenciasCustoSchema } from "./referencias-planejadas.js";
import { estimarPlanosProtocolos } from "./estimativa-protocolo.js";
const decimal=z.union([z.string().regex(/^\d+(?:\.\d+)?$/),z.number().finite().nonnegative()]).nullable().optional();
export const estimativaModeloSchema=z.object({propriedadeId:z.number().int().positive(),referenciasPagina:z.number().int().min(1).default(1),etapas:z.array(z.object({nome:z.string().max(120),tipo:z.enum(["APLICACAO","TENTATIVA","AVALIACAO","EXAME","RETIRADA","MANEJO"]),produtoId:z.string().uuid().nullable().optional(),quantidade:decimal,unidade:z.string().max(40).nullable().optional(),referenciasCusto:referenciasCustoSchema.optional()}).strict()).max(100)}).strict();
export type EstimativaModelo=z.infer<typeof estimativaModeloSchema>;
/** Leitura de um rascunho por animal; nenhuma participação/tarefa fictícia é construída. */
export async function estimarModeloTx(tx:Prisma.TransactionClient,input:EstimativaModelo){
 const consultadaEm=new Date(),saldos=new Map<string,{unidade:UnidadeMedida;custo:Prisma.Decimal|null}>();
 const planos:Array<{quantidade:Prisma.Decimal.Value|null;custoUnitario:Prisma.Decimal.Value|null}>=[];
 const referencias:Array<{descricao:string;natureza:string;origem:string;data:string|null;unidade:string|null;quantidade:string|null;valorUnitario:string|null;valor:string|null}>=[];
 for(const etapa of input.etapas){
  const refs=etapa.referenciasCusto;
  if(["APLICACAO","TENTATIVA"].includes(etapa.tipo)){
   let custo=refs?.material?new Prisma.Decimal(refs.material.valorUnitario):null;
   let unidadeRef=refs?.material?.unidade??etapa.unidade??null,origem=refs?.material?.origem??"Referência material não informada",data:string|null=refs?.material?.data??null;
   if(!refs?.material&&etapa.produtoId){
    if(!saldos.has(etapa.produtoId)){
     const produto=await tx.produto.findUnique({where:{id:etapa.produtoId},select:{unidade:true}});
     if(produto){const bases=(await saldosBasesTx(tx,etapa.produtoId,input.propriedadeId,consultadaEm)).filter(b=>b.quantidade.gt(0));const q=bases.reduce((s,b)=>s.plus(b.quantidade),new Prisma.Decimal(0)),v=bases.reduce((s,b)=>s.plus(b.valor),new Prisma.Decimal(0));saldos.set(etapa.produtoId,{unidade:produto.unidade,custo:q.gt(0)?v.div(q):null});}
    }
    const saldo=saldos.get(etapa.produtoId);custo=saldo?.custo??null;unidadeRef=saldo?.unidade??unidadeRef;if(saldo){origem="Saldo valorizado atual do sítio";data=consultadaEm.toISOString();}
   }
   let quantidade:Prisma.Decimal|null=null;
   if(etapa.quantidade!=null&&new Prisma.Decimal(etapa.quantidade).gt(0)&&etapa.unidade&&unidadeRef&&etapa.unidade in UNIDADES&&unidadeRef in UNIDADES){try{quantidade=converterQuantidade(new Prisma.Decimal(etapa.quantidade),etapa.unidade as UnidadeMedida,unidadeRef as UnidadeMedida);}catch{quantidade=null;}}
   planos.push({quantidade,custoUnitario:custo});referencias.push({descricao:etapa.nome,natureza:"MATERIAL",origem,data,unidade:unidadeRef,quantidade:quantidade?.toString()??null,valorUnitario:custo?.toString()??null,valor:quantidade!=null&&custo!=null?quantidade.mul(custo).toFixed(2):null});
  }
  const servico=refs?.servico;planos.push({quantidade:1,custoUnitario:servico?.valorUnitario??null});referencias.push({descricao:etapa.nome,natureza:"SERVICO",origem:servico?.origem??"Referência de serviço não informada",data:servico?.data??null,unidade:"POR_ATENDIMENTO",quantidade:"1",valorUnitario:servico?.valorUnitario??null,valor:servico?new Prisma.Decimal(servico.valorUnitario).toFixed(2):null});
 }
 const pagina=Math.min(input.referenciasPagina,Math.max(1,Math.ceil(referencias.length/10)));
 return {...estimarPlanosProtocolos(planos),acoes:input.etapas.length,referencias:{itens:referencias.slice((pagina-1)*10,pagina*10),total:referencias.length,pagina,porPagina:10}};
}
export const estimarModelo=(input:EstimativaModelo)=>prisma.$transaction(tx=>estimarModeloTx(tx,input),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
