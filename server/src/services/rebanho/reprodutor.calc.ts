// Cálculo puro do resumo da biblioteca de reprodutores (touros) — sem I/O. Médias dos PTAs e o
// melhor touro por índice (leite/TPI). Base para o painel e para a recomendação de acasalamento.

export interface ReprodutorIndices {
  id: number;
  ptaLeite: number | null;
  ptaGordura: number | null;
  ptaProteina: number | null;
  tpi: number | null;
}

export interface ResumoReprodutores {
  total: number;
  mediaPtaLeite: number | null;
  mediaPtaGordura: number | null;
  mediaPtaProteina: number | null;
  mediaTpi: number | null;
  melhorLeiteId: number | null; // maior ptaLeite
  melhorTpiId: number | null; // maior tpi
}

const media = (ns: number[]): number | null => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100 : null);

// id do reprodutor com o maior valor do campo (null se ninguém tem o valor).
function melhorPor(reprodutores: readonly ReprodutorIndices[], campo: keyof ReprodutorIndices): number | null {
  let melhor: ReprodutorIndices | null = null;
  for (const r of reprodutores) {
    const v = r[campo];
    if (v == null) continue;
    if (melhor == null || (v as number) > (melhor[campo] as number)) melhor = r;
  }
  return melhor ? melhor.id : null;
}

export function resumoIndices(reprodutores: readonly ReprodutorIndices[]): ResumoReprodutores {
  const col = (c: keyof ReprodutorIndices) => reprodutores.map((r) => r[c]).filter((v): v is number => v != null);
  return {
    total: reprodutores.length,
    mediaPtaLeite: media(col("ptaLeite")),
    mediaPtaGordura: media(col("ptaGordura")),
    mediaPtaProteina: media(col("ptaProteina")),
    mediaTpi: media(col("tpi")),
    melhorLeiteId: melhorPor(reprodutores, "ptaLeite"),
    melhorTpiId: melhorPor(reprodutores, "tpi"),
  };
}
