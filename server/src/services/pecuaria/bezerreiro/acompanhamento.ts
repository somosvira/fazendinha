import { Prisma } from '@prisma/client';
import { RebanhoError } from '../rebanho/regras.js';
/** Política e peso comprovados no primeiro acompanhamento do sítio; não confunde peso atual com peso ao nascer. */
export async function acompanharColostragemTx(tx:Prisma.TransactionClient,input:{animalId:string;criaId?:string;propriedadeId:number;data:Date},usuarioId:number|null){
 const antes=await tx.acompanhamentoColostragem.findUnique({where:{animalId_propriedadeId:{animalId:input.animalId,propriedadeId:input.propriedadeId}}});
 if(antes)return antes;
 const config=await tx.configuracaoBezerreiro.findFirst({where:{propriedadeId:input.propriedadeId},orderBy:{versao:'desc'}});
 const cria=input.criaId?await tx.criaParto.findFirst({where:{id:input.criaId,animalId:input.animalId}}):await tx.criaParto.findUnique({where:{animalId:input.animalId}});
 const declarado=cria?.filiacaoSnapshot&&typeof cria.filiacaoSnapshot==='object'&&!Array.isArray(cria.filiacaoSnapshot)?cria.filiacaoSnapshot.pesoKg:null;
 let peso:Prisma.Decimal|null=null,fonte:string|null=null;
 if((typeof declarado==='number'||typeof declarado==='string')&&/^\d+(\.\d+)?$/.test(String(declarado))&&new Prisma.Decimal(declarado).isFinite()&&new Prisma.Decimal(declarado).gt(0)){peso=new Prisma.Decimal(declarado);fonte='PESO_DECLARADO_PARTO';}
 if(!peso&&cria){const v=await tx.vinculoPesagemParto.findFirst({where:{criaId:cria.id,revogadoEm:null,pesagem:{animalId:input.animalId,data:{lte:input.data}}},include:{pesagem:true},orderBy:{criadoEm:'desc'}});if(v){peso=v.pesagem.pesoKg;fonte='PESAGEM_VINCULADA_PARTO:'+v.pesagemId;}}
 const meta=peso&&config?peso.mul(config.percentualPesoColostro).div(100).toDecimalPlaces(3):null;
 return tx.acompanhamentoColostragem.create({data:{animalId:input.animalId,propriedadeId:input.propriedadeId,configuracaoId:config?.id,pesoReferenciaKg:peso,metaLitros:meta,politicaSnapshot:JSON.parse(JSON.stringify({configuracaoId:config?.id??null,versao:config?.versao??null,percentualPesoColostro:config?.percentualPesoColostro.toFixed(2)??null,pesoReferenciaKg:peso?.toFixed(3)??null,pesoFonte:fonte,metaLitros:meta?.toFixed(3)??null})),criadoPorId:usuarioId}});
}
export async function vincularFornecimentoColostragemTx(tx:Prisma.TransactionClient,input:{animalId:string;criaId:string;fornecimentoId:string;propriedadeId:number;data:Date;motivoExcecao?:string|null},usuarioId:number|null){
 const acompanhamento=await acompanharColostragemTx(tx,input,usuarioId);
 const vinculo=await tx.vinculoFornecimentoColostragem.findUnique({where:{fornecimentoId:input.fornecimentoId}});if(vinculo){if(vinculo.acompanhamentoId!==acompanhamento.id)throw new RebanhoError('CONFLITO','Fornecimento já pertence a outro acompanhamento');return vinculo;}
 return tx.vinculoFornecimentoColostragem.create({data:{acompanhamentoId:acompanhamento.id,fornecimentoId:input.fornecimentoId,politicaSnapshot:acompanhamento.politicaSnapshot??Prisma.JsonNull,motivoExcecao:input.motivoExcecao,criadoPorId:usuarioId}});
}
