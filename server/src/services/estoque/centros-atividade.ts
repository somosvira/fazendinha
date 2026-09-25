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

export interface DbCentroCustoComNome {
  centroCusto: {
    findMany(args: { where: { nome: { in: string[] } }; select: { id: true; nome: true } }): Promise<{ id: number; nome: string }[]>;
  };
}

/**
 * Id do centro "de atividade" (café) num único findMany — usado pela tela de
 * Estoque (`routes/estoque-centros.ts`) e por `/financeiro/configuracoes`
 * (`routes/financeiro.ts`) para resolver o filtro inicial sem duas idas ao banco.
 */
export async function obterCentrosAtividade(db: DbCentroCustoComNome): Promise<{ cafe: number | null }> {
  const centros = await db.centroCusto.findMany({
    where: { nome: { in: [CENTROS_ATIVIDADE.CAFE] } },
    select: { id: true, nome: true },
  });
  return {
    cafe: centros.find((c) => c.nome === CENTROS_ATIVIDADE.CAFE)?.id ?? null,
  };
}
