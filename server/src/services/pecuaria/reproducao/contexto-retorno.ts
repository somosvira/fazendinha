import type { Prisma } from "@prisma/client";
/** O último exame válido substitui um retorno anterior mesmo quando não agenda outro. */
export async function carregarRetornosNaDataTx(tx: Prisma.TransactionClient, animalIds: string[], data: Date) {
  if (!animalIds.length) return new Map<string, Date | null>();
  const avaliacoes = await tx.avaliacaoReprodutiva.findMany({ where: { animalId: { in: [...new Set(animalIds)] }, status: "VALIDO", data: { lte: data } },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }], select: { animalId: true, retornoEm: true } });
  const retornos = new Map<string, Date | null>();
  for (const avaliacao of avaliacoes) if (!retornos.has(avaliacao.animalId)) retornos.set(avaliacao.animalId, avaliacao.retornoEm);
  const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:{in:[...new Set(animalIds)]},estado:"PENDENTE",dataReferencia:{lte:data}},orderBy:[{previstaPara:"asc"},{id:"asc"}],select:{animalId:true,previstaPara:true}});
  for(const d of demandas)if(!retornos.get(d.animalId)||d.previstaPara<retornos.get(d.animalId)!)retornos.set(d.animalId,d.previstaPara);
  return retornos;
}
export function contextoRetornoNaData(retornoEm: Date | null | undefined, data: Date) {
  const diaReferencia = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const diaRetorno = retornoEm ? Date.UTC(retornoEm.getUTCFullYear(), retornoEm.getUTCMonth(), retornoEm.getUTCDate()) : null;
  return { retornoEm: retornoEm?.toISOString().slice(0, 10) ?? null, retornoInformado: retornoEm != null,
    diasAteRetorno: diaRetorno == null ? null : Math.round((diaRetorno - diaReferencia) / 86400000) };
}
