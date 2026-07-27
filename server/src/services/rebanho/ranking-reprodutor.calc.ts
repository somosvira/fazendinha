export type DirecaoRanking = "maior_melhor" | "menor_melhor";

export interface ReprodutorRankItem {
  id: number;
  valorIndicador: number | null;
}

// Ordena reprodutores pelo valor de um indicador. Ausentes (null) vão sempre ao fim;
// empate desempata por id crescente (estável e determinístico).
export function ranquearPorIndicador<T extends ReprodutorRankItem>(
  reprodutores: readonly T[],
  direcao: DirecaoRanking,
): T[] {
  const sinal = direcao === "menor_melhor" ? -1 : 1;

  return [...reprodutores].sort((a, b) => {
    if (a.valorIndicador == null && b.valorIndicador == null) return a.id - b.id;
    if (a.valorIndicador == null) return 1;
    if (b.valorIndicador == null) return -1;
    if (a.valorIndicador !== b.valorIndicador) {
      return (b.valorIndicador - a.valorIndicador) * sinal;
    }
    return a.id - b.id;
  });
}
