import { Prisma } from "@prisma/client";
const D=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
/** Lê o razão agregado em lote, no corte atual, incluindo grupos sem lastro. */
export async function consultarEstoqueTx(tx:Prisma.TransactionClient,propriedadeId:number|null,principalId:number,data:Date){
  const fisico=await tx.$queryRaw<{produtoId:string;propriedadeId:number;partidaId:string|null;quantidade:Prisma.Decimal}[]>(Prisma.sql`
    SELECT m."produtoId",COALESCE(m."propriedadeId",${principalId}) AS "propriedadeId",
      CASE WHEN p."rastrearPartidas" THEN COALESCE(pp."lotePrincipalId",pp.id) ELSE NULL END AS "partidaId",
      SUM((CASE WHEN m.tipo='SAIDA' THEN -1 ELSE 1 END)*CASE WHEN p."rastrearPartidas" THEN COALESCE(a.quantidade,m.quantidade) ELSE m.quantidade END) AS quantidade
    FROM public."MovimentoEstoque" m JOIN public."Produto" p ON p.id=m."produtoId"
    LEFT JOIN public."AlocacaoPartidaEstoque" a ON p."rastrearPartidas" AND a."movimentoEstoqueId"=m.id
    LEFT JOIN public."PartidaProduto" pp ON pp.id=a."partidaId"
    WHERE m.status IN ('CONFIRMADO','REVERTIDO') AND m.data<=${data}
      ${propriedadeId==null?Prisma.empty:Prisma.sql`AND COALESCE(m."propriedadeId",${principalId})=${propriedadeId}`}
    GROUP BY 1,2,3`);
  const bases=await tx.$queryRaw<{id:string;produtoId:string;propriedadeId:number;partidaId:string|null;baseOrigemId:string|null;metodo:string;quantidade:Prisma.Decimal;valor:Prisma.Decimal}[]>(Prisma.sql`
    SELECT b.id,b."produtoId",b."propriedadeId",b."partidaId",b."baseOrigemId",b.metodo,
      b."quantidadeAbertura"+COALESCE(p.quantidade,0) AS quantidade,b."valorAbertura"+COALESCE(p.valor,0) AS valor
    FROM public."BaseValorizacaoEstoque" b JOIN public."Produto" produto ON produto.id=b."produtoId" LEFT JOIN LATERAL (
      SELECT SUM(p.quantidade) AS quantidade,SUM(p."valorTotal") AS valor FROM public."ParcelaValorizacaoEstoque" p
      JOIN public."MovimentoEstoque" m ON m.id=p."movimentoEstoqueId" WHERE p."baseId"=b.id AND m.data<=${data}) p ON true
    WHERE b."disponivelDesde"<=${data} AND (b."corteAbertura" IS NULL OR b."corteAbertura"<=${data})
      ${propriedadeId==null?Prisma.empty:Prisma.sql`AND b."propriedadeId"=${propriedadeId}`}
      AND b.metodo=CASE WHEN produto."rastrearPartidas" THEN 'MEDIA_SALDO_V1' ELSE 'FIFO_AQUISICAO_V1' END
    ORDER BY b."disponivelDesde",b.ordem,b.id`);
  const produtos=await tx.produto.findMany({where:{id:{in:[...new Set([...fisico,...bases].map(f=>f.produtoId))]}},select:{id:true,nome:true,unidade:true}});
  const grupos=new Map(fisico.map(f=>[`${f.produtoId}:${f.propriedadeId}:${f.partidaId}`,f]));
  for(const b of bases){const k=`${b.produtoId}:${b.propriedadeId}:${b.partidaId}`;if(!grupos.has(k))grupos.set(k,{...b,quantidade:D(0)});}
  const itens=[...grupos.values()].map(f=>{const basesGrupo=bases.filter(b=>b.produtoId===f.produtoId&&b.propriedadeId===f.propriedadeId&&b.partidaId===f.partidaId);
    const quantidadeValorizada=basesGrupo.reduce((s,b)=>s.plus(b.quantidade),D(0));const conhecido=D(f.quantidade).eq(quantidadeValorizada);
    const produto=produtos.find(p=>p.id===f.produtoId)!;
    return {produtoId:f.produtoId,produto:produto.nome,unidade:produto.unidade,propriedadeId:f.propriedadeId,partidaId:f.partidaId,quantidade:D(f.quantidade).toFixed(3),quantidadeValorizada:quantidadeValorizada.toFixed(3),
      valor:conhecido?basesGrupo.reduce((s,b)=>s.plus(b.valor),D(0)).toFixed(2):null,
      bases:basesGrupo.map(b=>({id:b.id,baseOrigemId:b.baseOrigemId,metodo:b.metodo,quantidade:D(b.quantidade).toFixed(3),valor:D(b.valor).toFixed(2)}))};
  }).filter(i=>!D(i.quantidade).isZero()||i.valor==null||D(i.valor).gt(0));
  return {data:texto(data),valorConhecido:itens.reduce((s,i)=>s.plus(i.valor??0),D(0)).toFixed(2),gruposPendentes:itens.filter(i=>i.valor==null).length,itens,
    metodologia:"Estoque atual no corte indicado, independente do período de caixa/nutrição. Valores conforme o método já registrado no estoque: média do grupo rastreado ou FIFO sem rastreio."};
}
const texto=(d:Date)=>d.toISOString().slice(0,10);
