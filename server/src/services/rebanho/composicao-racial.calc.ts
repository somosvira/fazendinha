// Cálculo puro da composição do rebanho por grau de cruzamento (grau de sangue) — sem I/O.
// A fração de sangue já é capturada no cadastro (`grauSangue`, ex.: "5/8 GL, HO"). Aqui só
// extraímos a fração e agrupamos o plantel. Espelha GRAUCRUZAMENTO do IDEagri (lookup).

export const PURO = "Puro / sem grau";

// Extrai a fração no início do grau de sangue ("5/8 GL, HO" → "5/8"). Sem fração → PURO.
export function extrairFracao(grauSangue: string | null | undefined): string {
  if (!grauSangue) return PURO;
  const m = grauSangue.match(/^\s*(\d+\/\d+)/);
  return m ? m[1] : PURO;
}

export interface GrauDistribuicao {
  grau: string;
  quantidade: number;
  pct: number; // % do rebanho (arredondado)
}

export interface ComposicaoRacial {
  total: number;
  distribuicao: GrauDistribuicao[]; // por quantidade desc, empate alfabético
}

export function agruparPorGrau(animais: readonly { grauSangue: string | null }[]): ComposicaoRacial {
  const total = animais.length;
  if (total === 0) return { total: 0, distribuicao: [] };

  const contagem = new Map<string, number>();
  for (const a of animais) {
    const g = extrairFracao(a.grauSangue);
    contagem.set(g, (contagem.get(g) ?? 0) + 1);
  }

  const distribuicao = [...contagem.entries()]
    .map(([grau, quantidade]) => ({ grau, quantidade, pct: Math.round((quantidade / total) * 100) }))
    .sort((a, b) => b.quantidade - a.quantidade || a.grau.localeCompare(b.grau, "pt-BR"));

  return { total, distribuicao };
}
