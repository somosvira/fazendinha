// Nomes canônicos dos centros de custo usados pelos módulos operacionais para
// atribuir custo por atividade (leite/café). Centralizados aqui para evitar
// strings hardcoded espalhadas em services/seeds/rotas — ver custo-producao.ts,
// plantio/custo.ts e os seeds.
export const CENTROS_ATIVIDADE = {
  LEITE: "Atividade Leiteira",
  CAFE: "Plantio Café",
  CAFE_INVESTIMENTO: "Plantio Café - investimento",
  PLANTIO: "Atividade Plantio",
} as const;

export interface DbCentroCusto {
  centroCusto: {
    findMany(args: { where: { nome: { in: string[] } }; select: { id: true } }): Promise<{ id: number }[]>;
  };
}

/** Resolve ids de CentroCusto a partir de uma lista de nomes (um único findMany). */
export async function resolverIdsCentros(db: DbCentroCusto, nomes: readonly string[]): Promise<number[]> {
  if (nomes.length === 0) return [];
  const centros = await db.centroCusto.findMany({ where: { nome: { in: [...nomes] } }, select: { id: true } });
  return centros.map((c) => c.id);
}
