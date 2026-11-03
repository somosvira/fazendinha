import {prisma} from '../../../db.js';

/** A busca identifica animais que passaram pelo sítio; fatos e valores conservam seus próprios gates. */
export function buscarAnimaisHistoricosRelatorio(propriedadeId:number,busca:string) {
  return prisma.animal.findMany({
    where:{localizacoes:{some:{propriedadeId}},...(busca?{OR:[{brinco:{contains:busca,mode:'insensitive' as const}},{nome:{contains:busca,mode:'insensitive' as const}}]}:{})},
    select:{id:true,brinco:true,nome:true},orderBy:[{brinco:'asc'},{id:'asc'}],take:20,
  });
}
