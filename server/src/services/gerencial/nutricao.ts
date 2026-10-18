import { Prisma } from "@prisma/client";
import { intervalosPresenca, textoDia } from "./presenca.calc.js";
import { calcularNutricao, diasIntervalos, type PresencaDia } from "./nutricao.calc.js";
export async function consultarNutricaoTx(tx:Prisma.TransactionClient,propriedadeId:number|null,inicio:Date,fim:Date){
  const fechamentos=await tx.fechamentoConsumo.findMany({where:{...(propriedadeId==null?{}:{propriedadeId}),status:"CONFIRMADO",inicio:{lte:fim},fim:{gte:inicio}},
    include:{centroCusto:{select:{nome:true}},participacoes:{include:{classificacaoCusto:true}},itens:{include:{movimentoEstoque:{select:{valorTotal:true}}}}}});
  const desde=new Date(Math.min(+inicio,...fechamentos.map(f=>+f.inicio)));const ate=new Date(Math.max(+fim,...fechamentos.map(f=>+f.fim)));
  const locais=await tx.localizacaoAnimal.findMany({where:{...(propriedadeId==null?{}:{propriedadeId}),desde:{lte:ate},OR:[{ate:null},{ate:{gt:desde}}]},
    include:{animal:{include:{partos:true,categoriasManuais:true}}}});
  const animais=new Map(locais.map(l=>[l.animalId,l.animal]));
  const presencas:PresencaDia[]=[];
  for(const animal of animais.values()){
    const segmentos=intervalosPresenca(animal,locais,desde,ate);
    for(const s of segmentos){const local=locais.find(l=>l.id===s.localizacaoId)!;
      for(const d of diasIntervalos([s]))presencas.push({...d,animalId:animal.id,propriedadeId:local.propriedadeId});
    }
  }
  return calcularNutricao(presencas,fechamentos.map(f=>({...f,centroCustoNome:f.centroCusto.nome,
    participacoes:f.participacoes.map(p=>({...p,finalidade:p.classificacaoCusto?.finalidade??null,
      intervalos:animais.has(p.animalId)?intervalosPresenca(animais.get(p.animalId)!,locais.filter(l=>l.propriedadeId===f.propriedadeId&&l.loteId===f.loteId),f.inicio,f.fim):[]})),
    itens:f.itens.map(i=>({...i,quantidadeConfirmada:i.quantidadeConfirmada.toString(),custoConhecido:i.quantidadeConfirmada.isZero()?"0":i.situacaoCusto==="CONHECIDO"?i.movimentoEstoque?.valorTotal.toFixed(2)??null:null}))})),textoDia(inicio),textoDia(fim));
}
