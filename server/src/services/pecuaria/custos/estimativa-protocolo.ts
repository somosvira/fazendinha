import { Prisma, type UnidadeMedida } from "@prisma/client";
import { saldosBasesTx } from "../../estoque/valorizacao.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";

type PlanoEstimativa = { produtoId:string|null; quantidade:Prisma.Decimal.Value|null; unidade:string|null };
export function estimarPlanosProtocolos(planos:Array<{quantidade:Prisma.Decimal.Value|null;custoUnitario:Prisma.Decimal.Value|null}>,servicosSemReferencia=0) {
  let conhecido=new Prisma.Decimal(0);let conhecidos=0;let desconhecidos=servicosSemReferencia;
  for(const p of planos){if(p.quantidade==null||p.custoUnitario==null){desconhecidos++;continue;}conhecido=conhecido.plus(new Prisma.Decimal(p.quantidade).mul(p.custoUnitario));conhecidos++;}
  const situacao=!conhecidos?"NAO_APURADO":desconhecidos?"PARCIAL":"COMPLETO";
  return {situacao,total:situacao==="COMPLETO"?conhecido.toFixed(2):null,totalConhecido:conhecidos?conhecido.toFixed(2):null,componentesConhecidos:conhecidos,componentesPendentes:desconhecidos,referencia:"Saldo valorizado atual do sítio; estimativa sem reserva ou baixa de estoque",limitacoes:["Serviços sem referência planejada permanecem não apurados; não inclui despesas gerais"]};
}
/** Apenas lê bases documentadas; não usa planejarSaidaTx, que trava/valida escrita. */
export async function estimarProtocoloTx(tx:Prisma.TransactionClient,propriedadeId:number,where:Prisma.ParticipacaoProtocoloWhereInput,tarefasNoEscopo:Prisma.TarefaProtocoloWhereInput={}) {
  const tarefas=await tx.tarefaProtocolo.findMany({where:{execucao:where,AND:[tarefasNoEscopo]},select:{parametros:true,etapa:{select:{tipo:true,produtoId:true,dose:true,unidade:true,material:{select:{produtoId:true}}}}}});
  const planos:PlanoEstimativa[]=[];let servicos=0;
  for(const t of tarefas){const p=t.parametros&&typeof t.parametros==="object"&&!Array.isArray(t.parametros)?t.parametros:{};const etapa=p.etapa&&typeof p.etapa==="object"&&!Array.isArray(p.etapa)?p.etapa:{};const aplicacao=etapa.planoAplicacao&&typeof etapa.planoAplicacao==="object"&&!Array.isArray(etapa.planoAplicacao)?etapa.planoAplicacao:{};const tentativa=etapa.planoTentativa&&typeof etapa.planoTentativa==="object"&&!Array.isArray(etapa.planoTentativa)?etapa.planoTentativa:{};
    if(["APLICACAO","TENTATIVA","EXAME"].includes(t.etapa.tipo))servicos++;
    if(t.etapa.tipo==="APLICACAO")planos.push({produtoId:typeof aplicacao.produtoId==="string"?aplicacao.produtoId:typeof p.produtoId==="string"?p.produtoId:t.etapa.produtoId,quantidade:typeof aplicacao.dose==="string"?aplicacao.dose:typeof p.dose==="string"?p.dose:t.etapa.dose,unidade:typeof aplicacao.unidadeDose==="string"?aplicacao.unidadeDose:typeof p.unidade==="string"?p.unidade:t.etapa.unidade});
    if(t.etapa.tipo==="TENTATIVA")planos.push({produtoId:t.etapa.material?.produtoId??null,quantidade:typeof tentativa.quantidade==="number"?tentativa.quantidade:null,unidade:null});
  }
  const referencias=new Map<string,{custo:Prisma.Decimal|null;unidade:UnidadeMedida}>();
  for(const produtoId of new Set(planos.flatMap(p=>p.produtoId?[p.produtoId]:[]))){const produto=await tx.produto.findUnique({where:{id:produtoId},select:{unidade:true}});if(!produto)continue;const bases=await saldosBasesTx(tx,produtoId,propriedadeId,new Date());const disponiveis=bases.filter(b=>b.quantidade.gt(0));const quantidade=disponiveis.reduce((s,b)=>s.plus(b.quantidade),new Prisma.Decimal(0));const valor=disponiveis.reduce((s,b)=>s.plus(b.valor),new Prisma.Decimal(0));referencias.set(produtoId,{unidade:produto.unidade,custo:quantidade.gt(0)?valor.div(quantidade):null});}
  return estimarPlanosProtocolos(planos.map(p=>{const ref=p.produtoId?referencias.get(p.produtoId):null;let quantidade:Prisma.Decimal|null=null;if(p.quantidade!=null&&ref){try{quantidade=p.unidade&&p.unidade in UNIDADES?converterQuantidade(new Prisma.Decimal(p.quantidade),p.unidade as UnidadeMedida,ref.unidade):p.unidade?null:new Prisma.Decimal(p.quantidade);}catch{quantidade=null;}}return{quantidade,custoUnitario:ref?.custo??null};}),servicos);
}
