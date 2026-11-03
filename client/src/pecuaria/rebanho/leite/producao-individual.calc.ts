import type { AfericaoIndividual } from "./historico-types";
/** Só observações persistidas: ausência, exclusão e pendência não criam litros. */
export function resumirAfericoesIndividuais(serie: readonly AfericaoIndividual[]) {
  const pontos = serie.filter((p): p is AfericaoIndividual & { litros: number } => !p.excluido && p.litros !== null).sort((a, b) => a.data.localeCompare(b.data));
  const ultima = pontos.at(-1) ?? null, anterior = pontos.at(-2) ?? null;
  const comparaveis = ultima && anterior && ultima.completa && anterior.completa && ultima.lactacaoId !== null && ultima.lactacaoId === anterior.lactacaoId && ultima.comparabilidade === anterior.comparabilidade;
  const variacao = comparaveis ? ultima.litros - anterior.litros : null;
  return { pontos, ultima, anterior, variacao, percentual: variacao !== null && anterior && anterior.litros !== 0 ? variacao / anterior.litros * 100 : null,
    media: pontos.length ? pontos.reduce((s, p) => s + p.litros, 0) / pontos.length : null,
    maior: pontos.reduce<typeof ultima>((maior, p) => !maior || p.litros > maior.litros ? p : maior, null) };
}
