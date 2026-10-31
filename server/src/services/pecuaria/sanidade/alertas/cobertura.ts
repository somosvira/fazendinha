import type {Prisma} from "@prisma/client";
/** Usa a mesma trava da conclusão dos lotes: uma alteração nunca perde seu sinal de reavaliação. */
export async function marcarReavaliacaoSanitariaTx(tx:Prisma.TransactionClient){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('avaliacao-alertas-sanidade',0))`;
 await tx.avaliacaoAlertas.upsert({where:{id:"sanidade"},create:{id:"sanidade",produtor:"sanidade",estado:"DESATUALIZADO",versao:1},update:{estado:"DESATUALIZADO",diaCoberto:null,cursor:null,erro:null,versao:{increment:1}}});
}
