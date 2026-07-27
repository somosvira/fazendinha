export type ColunaLegada = "ptaLeite" | "ptaGordura" | "ptaProteina" | "tpi";
export interface ValorIndicadorEspelho { indicadorId: number; valor: number }
export interface IndicadorEspelho { id: number; colunaLegada: ColunaLegada | null }

const COLUNAS: readonly ColunaLegada[] = ["ptaLeite", "ptaGordura", "ptaProteina", "tpi"];

// Projeta os valores de indicadores com `colunaLegada` de volta nas colunas PTA do Reprodutor,
// para manter reprodutor.calc/acasalamento.calc/UI de ranking atuais sem reescrita.
export function projetarColunasLegadas(
  valores: readonly ValorIndicadorEspelho[],
  indicadoresPorId: ReadonlyMap<number, IndicadorEspelho>,
): Partial<Record<ColunaLegada, number>> {
  const out: Partial<Record<ColunaLegada, number>> = {};
  for (const v of valores) {
    const ind = indicadoresPorId.get(v.indicadorId);
    const col = ind?.colunaLegada;
    if (col && COLUNAS.includes(col)) out[col] = v.valor;
  }
  return out;
}
