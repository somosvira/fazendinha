import { Prisma } from "@prisma/client";
import { incluirClassificacao, ratearTransacao } from "../financeiro/classificacao.js";
import { movimentoRealizado } from "../financeiro/dashboard.calc.js";
import { textoDia } from "./presenca.calc.js";
const D=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
export async function consultarCaixaTx(tx: Prisma.TransactionClient, propriedadeId:number|null, inicio:Date, fim:Date) {
  const movimentos=await tx.movimentoConta.findMany({where:{transacao:{...(propriedadeId==null?{}:{propriedadeId}),data:{gte:inicio,lte:fim}}},include:{transacao:{include:{reversaoDe:{select:{tipo:true}},operacao:{include:incluirClassificacao}}}}});
  const meses=new Map<string,{mes:string;entradas:Prisma.Decimal;saidas:Prisma.Decimal;incompleto:boolean}>();
  for(let cursor=new Date(Date.UTC(inicio.getUTCFullYear(),inicio.getUTCMonth(),1));cursor<=fim;cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1))) {
    const ultimo=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0));const mes=textoDia(cursor).slice(0,7);
    meses.set(mes,{mes,entradas:D(0),saidas:D(0),incompleto:inicio>cursor||fim<ultimo});
  }
  const centros=new Map<string,{id:string|null;nome:string;entradas:Prisma.Decimal;saidas:Prisma.Decimal}>();
  const fontes: {transacaoId:string;operacaoId:string|null;contaId:string;movimentoId:string;propriedadeId:number;data:string;campo:string;valor:string}[]=[];
  for(const m of movimentos){const r=movimentoRealizado(m);if(!r)continue;
    meses.get(textoDia(m.transacao.data).slice(0,7))![r.campo]=meses.get(textoDia(m.transacao.data).slice(0,7))![r.campo].plus(r.valor);
    fontes.push({contaId:m.contaId,movimentoId:m.id,propriedadeId:m.transacao.propriedadeId,transacaoId:m.transacaoId,operacaoId:m.transacao.operacaoId,data:textoDia(m.transacao.data),campo:r.campo,valor:r.valor.toFixed(2)});
    for(const p of ratearTransacao(m.transacao.operacao,m.transacaoId,m.valor)){
      const k=p.centroCustoId??"sem-centro";const c=centros.get(k)??{id:p.centroCustoId,nome:p.centroCustoNome??"Sem centro de custo",entradas:D(0),saidas:D(0)};
      c[r.campo]=c[r.campo].plus(p.valor.abs().mul(r.valor.isNegative()?-1:1));centros.set(k,c);
    }
  }
  const entradas=[...meses.values()].reduce((s,m)=>s.plus(m.entradas),D(0));const saidas=[...meses.values()].reduce((s,m)=>s.plus(m.saidas),D(0));
  const apresentar=(m:{entradas:Prisma.Decimal;saidas:Prisma.Decimal})=>({entradas:m.entradas.toFixed(2),saidas:m.saidas.toFixed(2),resultado:m.entradas.minus(m.saidas).toFixed(2)});
  return {...apresentar({entradas,saidas}),mensal:[...meses.values()].map(m=>({mes:m.mes,incompleto:m.incompleto,...apresentar(m)})),centros:[...centros.values()].map(c=>({id:c.id,nome:c.nome,...apresentar(c)})),fontes,
    metodologia:"Movimentos realizados na data da transação. Estornos abatem a natureza original; transferências próprias e compromissos não liquidados ficam fora. Compra, pagamento e consumo são perspectivas distintas."};
}
