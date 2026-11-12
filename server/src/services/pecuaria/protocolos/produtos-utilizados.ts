import { Prisma } from "@prisma/client";

type Material = { fonteId: string; tipoFonte: string; natureza: string; estado: string; animalId: string; valor: string | null };
export type ConsumoProduto = { chave: string; nome: string; unidade: string | null; quantidade: string | null; animalId: string; valor: string | null; estado: string };
export function agruparProdutosUtilizados(consumos: ConsumoProduto[], verValores: boolean) {
  const grupos = new Map<string, { produto: string; unidade: string | null; quantidade: Prisma.Decimal; quantidadeParcial: boolean; animais: Set<string>; atendimentos: number; custo: Prisma.Decimal; conhecidos: number; pendentes: number }>();
  for (const c of consumos) {
    const chave = JSON.stringify([c.chave, c.unidade]);
    const g = grupos.get(chave) ?? { produto:c.nome, unidade:c.unidade, quantidade:new Prisma.Decimal(0), quantidadeParcial:false, animais:new Set<string>(), atendimentos:0, custo:new Prisma.Decimal(0), conhecidos:0, pendentes:0 };
    if(c.quantidade == null) g.quantidadeParcial = true; else g.quantidade = g.quantidade.plus(c.quantidade);
    g.animais.add(c.animalId); g.atendimentos++;
    if(c.valor != null) { g.custo=g.custo.plus(c.valor);g.conhecidos++; } else if(c.estado === "DESCONHECIDO") g.pendentes++;
    grupos.set(chave,g);
  }
  return [...grupos].map(([id,g])=>({id,produto:g.produto,unidade:g.unidade,quantidade:g.quantidadeParcial ? null : g.quantidade.toString(),animais:g.animais.size,atendimentos:g.atendimentos,custo:verValores && g.conhecidos ? g.custo.toFixed(2) : null,parcial:verValores && g.pendentes>0})).sort((a,b)=>a.produto.localeCompare(b.produto,"pt-BR"));
}
/** IDs vêm exclusivamente dos componentes já autorizados e deduplicados do contexto. */
export async function produtosUtilizadosTx(tx: Prisma.TransactionClient, componentes: Material[], verValores: boolean) {
  const materiais=componentes.filter(c=>c.natureza === "MATERIAL" && c.estado !== "NAO_APLICAVEL");
  const aplicacaoIds=materiais.filter(c=>c.tipoFonte === "APLICACAO").map(c=>c.fonteId);
  const tentativaIds=materiais.filter(c=>c.tipoFonte === "TENTATIVA").map(c=>c.fonteId);
  const [aplicacoes,tentativas]=await Promise.all([
    aplicacaoIds.length ? tx.aplicacaoProduto.findMany({where:{id:{in:aplicacaoIds}},select:{id:true,produtoId:true,nomeProdutoAplicado:true,dose:true,unidadeDose:true}}) : [],
    tentativaIds.length ? tx.tentativaReprodutiva.findMany({where:{id:{in:tentativaIds}},select:{id:true,quantidade:true,MaterialGenetico:{select:{produtoId:true,produto:{select:{nome:true,unidade:true}}}}}}) : [],
  ]);
  const consumos:ConsumoProduto[]=[];
  for(const c of materiais) {
    const a=aplicacoes.find(a=>c.tipoFonte === "APLICACAO" && a.id === c.fonteId);
    const t=tentativas.find(t=>c.tipoFonte === "TENTATIVA" && t.id === c.fonteId);
    if(a) consumos.push({...c,chave:a.produtoId ?? `nome:${a.nomeProdutoAplicado}`,nome:a.nomeProdutoAplicado,quantidade:a.dose?.toString() ?? null,unidade:a.unidadeDose});
    else if(t?.MaterialGenetico) consumos.push({...c,chave:t.MaterialGenetico.produtoId,nome:t.MaterialGenetico.produto.nome,quantidade:t.quantidade?.toString() ?? null,unidade:t.MaterialGenetico.produto.unidade});
  }
  return agruparProdutosUtilizados(consumos,verValores);
}
