// Cálculo puro: resolve qual centro de custo grava numa SAIDA de estoque gerada
// automaticamente (nutrição, sanidade, ajuste, aplicação agrícola). Regra:
// o contexto (lote/talhão/input explícito) manda; na ausência dele, só se o
// produto pertencer a um único centro de custo é que dá pra inferir sozinho —
// com mais de um, fica ambíguo e o movimento sai sem centro (null).
export interface ResolverCentroSaidaIn {
  produtoCentroIds: number[];
  contextoCentroId: number | null | undefined;
}

export function resolverCentroSaida(input: ResolverCentroSaidaIn): number | null {
  if (input.contextoCentroId != null) return input.contextoCentroId;
  if (input.produtoCentroIds.length === 1) return input.produtoCentroIds[0];
  return null;
}
