// Cálculo puro da análise de tanque (qualidade do leite bulk) — sem I/O, testável isoladamente.
// Entrada: leituras de análise de um tanque ao longo do tempo. Saída: última leitura, tendências
// de CCS e CBT por data e médias de gordura/proteína. Espelha "Análise de tanque" do IDEagri.

export interface AnaliseTanqueLeitura {
  data: string; // YYYY-MM-DD
  ccs: number | null;
  cbt: number | null;
  gordura: number | null;
  proteina: number | null;
}

export interface PontoTendencia {
  data: string;
  valor: number;
}

export interface ResumoTanque {
  total: number;
  ultima: AnaliseTanqueLeitura | null; // análise de data mais recente
  tendenciaCCS: PontoTendencia[]; // por data asc, só leituras com CCS
  tendenciaCBT: PontoTendencia[]; // por data asc, só leituras com CBT
  gorduraMedia: number | null;
  proteinaMedia: number | null;
}

const media = (ns: number[]): number | null => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null);

function tendencia(leituras: readonly AnaliseTanqueLeitura[], campo: "ccs" | "cbt"): PontoTendencia[] {
  return leituras
    .filter((l) => l[campo] != null)
    .map((l) => ({ data: l.data, valor: l[campo] as number }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function agregarTanque(leituras: readonly AnaliseTanqueLeitura[]): ResumoTanque {
  if (leituras.length === 0) {
    return { total: 0, ultima: null, tendenciaCCS: [], tendenciaCBT: [], gorduraMedia: null, proteinaMedia: null };
  }
  // Última = data mais recente (desempate: mantém a última vista na lista).
  let ultima = leituras[0];
  for (const l of leituras) if (l.data >= ultima.data) ultima = l;

  const gorduraMedia = media(leituras.filter((l) => l.gordura != null).map((l) => l.gordura as number));
  const proteinaMedia = media(leituras.filter((l) => l.proteina != null).map((l) => l.proteina as number));

  return {
    total: leituras.length,
    ultima,
    tendenciaCCS: tendencia(leituras, "ccs"),
    tendenciaCBT: tendencia(leituras, "cbt"),
    gorduraMedia: gorduraMedia == null ? null : Math.round(gorduraMedia * 100) / 100,
    proteinaMedia: proteinaMedia == null ? null : Math.round(proteinaMedia * 100) / 100,
  };
}
