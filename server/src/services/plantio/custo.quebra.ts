// Quebra de custo por categoria (puro). Veio do custo de produção do rebanho legado; hoje só o plantio usa.

// ── Motor puro (TDD) ────────────────────────────────────────────────────────
// Quebra o custeio por componente: soma por categoria, ordena desc e
// calcula a participação (%) sobre o total. Testável sem Prisma.

export interface ItemCusto {
  categoria: string;
  valor: number;
}
export interface QuebraCusto {
  total: number;
  linhas: { categoria: string; valor: number; pct: number }[];
}

export function quebrarPorCategoria(itens: ItemCusto[]): QuebraCusto {
  const por = new Map<string, number>();
  for (const i of itens) por.set(i.categoria, (por.get(i.categoria) ?? 0) + i.valor);
  const total = Math.round([...por.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const linhas = [...por.entries()]
    .map(([categoria, valor]) => ({
      categoria,
      valor: Math.round(valor * 100) / 100,
      pct: total > 0 ? Math.round((valor / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  return { total, linhas };
}
