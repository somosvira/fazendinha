import type { Prisma } from "@prisma/client";

/**
 * Escopo de leitura do Leite: um sítio ou, em Consolidado (`null`), todos os sítios ativos.
 * Devolve o filtro Prisma de `propriedadeId` e o nome de cada sítio para identificar as linhas.
 */
export async function escopoSitiosTx(tx: Prisma.TransactionClient, propriedadeId: number | null) {
  if (propriedadeId != null) return { consolidado: false as const, propriedadeId: propriedadeId as number | { in: number[] }, nome: (_id: number): string | null => null };
  const sitios = await tx.propriedade.findMany({ where: { ativo: true }, select: { id: true, nome: true } });
  const nomes = new Map(sitios.map(s => [s.id, s.nome]));
  return { consolidado: true as const, propriedadeId: { in: sitios.map(s => s.id) } as number | { in: number[] }, nome: (id: number): string | null => nomes.get(id) ?? null };
}
