import type { Prisma } from "@prisma/client";

export async function consultarAplicacoesTabletPendentes(
  tx: Prisma.TransactionClient,
  data: Date,
  filtro: { animalIds: string[] } | { propriedadeId: number },
) {
  if ("animalIds" in filtro && !filtro.animalIds.length) return [];
  const envios = await tx.envioAplicacoesTablet.findMany({
    where: { data: { lte: data }, ...("animalIds" in filtro ? { animalIds: { hasSome: filtro.animalIds } } : filtro),
      OR: [{ revisadoEm: null }, { devolucao: { not: null } }] },
    select: { id: true, animalIds: true, data: true, aplicadaEm: true },
  });
  if (!envios.length) return [];
  const substituidos = await tx.envioAplicacoesTablet.findMany({
    where: { corrigeId: { in: envios.map(e => e.id) } }, select: { corrigeId: true },
  });
  const anteriores = new Set(substituidos.map(s => s.corrigeId));
  return envios.filter(e => !anteriores.has(e.id));
}
