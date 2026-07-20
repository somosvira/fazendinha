// Cálculo puro da análise de leite (qualidade) do rebanho — sem I/O, testável isoladamente.
// Entrada: leituras de exame de leite (CCS/gordura/proteína) por animal ao longo do tempo.
// Saída: tendência de CCS por mês, distribuição por faixa (da leitura mais recente de cada
// animal), médias de gordura/proteína e ranking dos piores CCS. Espelha ANALISELEITE do IDEagri.

// Faixas de CCS (mil céls/mL) — mesmas do cockpit (ccsClassificacao): excelente < 200,
// atenção 200–399, alarme ≥ 400. Padrão de referência para qualidade do leite/mastite subclínica.
export const LIMIAR_CCS_ATENCAO = 200;
export const LIMIAR_CCS_ALARME = 400;

export type FaixaCCS = "EXCELENTE" | "ATENCAO" | "ALARME";

export function classificarCCS(ccs: number): FaixaCCS {
  if (ccs < LIMIAR_CCS_ATENCAO) return "EXCELENTE";
  if (ccs < LIMIAR_CCS_ALARME) return "ATENCAO";
  return "ALARME";
}

export interface LeituraLeite {
  animalId: number;
  data: string; // YYYY-MM-DD
  ccs: number | null;
  gordura: number | null;
  proteina: number | null;
}

export interface PontoTendenciaCCS {
  mes: string; // YYYY-MM
  ccsMedio: number; // média do rebanho no mês (arredondada)
  leituras: number;
}

export interface PiorAnimalCCS {
  animalId: number;
  ccs: number;
  data: string;
  faixa: FaixaCCS;
}

export interface AnaliseLeite {
  totalLeituras: number;
  animaisComLeitura: number; // animais com ao menos uma leitura de CCS
  ccsMedioAtual: number | null; // média das leituras de CCS mais recentes por animal
  gorduraMedia: number | null;
  proteinaMedia: number | null;
  tendenciaCCS: PontoTendenciaCCS[]; // por mês, crescente
  distribuicao: Record<FaixaCCS, number>; // contagem de animais por faixa (leitura mais recente)
  pioresAnimais: PiorAnimalCCS[]; // top CCS da leitura mais recente, desc
}

const media = (ns: number[]): number | null => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null);
const arred = (n: number) => Math.round(n);

// Última leitura de CCS de cada animal (mais recente por data; desempate: mantém a última vista).
function ultimaLeituraCCSPorAnimal(leituras: LeituraLeite[]): Map<number, LeituraLeite> {
  const porAnimal = new Map<number, LeituraLeite>();
  for (const l of leituras) {
    if (l.ccs == null) continue;
    const atual = porAnimal.get(l.animalId);
    if (!atual || l.data >= atual.data) porAnimal.set(l.animalId, l);
  }
  return porAnimal;
}

export function agregarAnaliseLeite(leituras: LeituraLeite[]): AnaliseLeite {
  const comCCS = leituras.filter((l) => l.ccs != null) as (LeituraLeite & { ccs: number })[];

  // Tendência por mês (YYYY-MM): média do rebanho no mês.
  const porMes = new Map<string, number[]>();
  for (const l of comCCS) {
    const mes = l.data.slice(0, 7);
    const lista = porMes.get(mes) ?? [];
    lista.push(l.ccs);
    porMes.set(mes, lista);
  }
  const tendenciaCCS: PontoTendenciaCCS[] = [...porMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, ccss]) => ({ mes, ccsMedio: arred(media(ccss)!), leituras: ccss.length }));

  // Distribuição + médias + piores: a partir da leitura MAIS RECENTE de cada animal.
  const ultimas = [...ultimaLeituraCCSPorAnimal(comCCS).values()];
  const distribuicao: Record<FaixaCCS, number> = { EXCELENTE: 0, ATENCAO: 0, ALARME: 0 };
  for (const l of ultimas) distribuicao[classificarCCS(l.ccs!)]++;

  const ccsMedioAtual = ultimas.length ? arred(media(ultimas.map((l) => l.ccs!))!) : null;

  const pioresAnimais: PiorAnimalCCS[] = ultimas
    .map((l) => ({ animalId: l.animalId, ccs: l.ccs!, data: l.data, faixa: classificarCCS(l.ccs!) }))
    .sort((a, b) => b.ccs - a.ccs || a.animalId - b.animalId);

  // Médias de gordura/proteína (todas as leituras que têm o valor).
  const gorduraMedia = media(leituras.filter((l) => l.gordura != null).map((l) => l.gordura as number));
  const proteinaMedia = media(leituras.filter((l) => l.proteina != null).map((l) => l.proteina as number));

  return {
    totalLeituras: leituras.length,
    animaisComLeitura: ultimas.length,
    ccsMedioAtual,
    gorduraMedia: gorduraMedia == null ? null : Math.round(gorduraMedia * 100) / 100,
    proteinaMedia: proteinaMedia == null ? null : Math.round(proteinaMedia * 100) / 100,
    tendenciaCCS,
    distribuicao,
    pioresAnimais,
  };
}
