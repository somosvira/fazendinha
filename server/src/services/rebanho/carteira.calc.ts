// Motor puro da Carteira do rebanho (Prisma-free, testado por TDD).
// Recebe os animais já materializados (score + margem + produção) pela carteira.ts
// e só agrega/simula. Nenhuma query, nenhum acesso a config — determinístico.

import type { ScoreClassificacao } from "./score.calc.js";

// Ordem canônica das faixas (melhor → pior), usada na distribuição e nos labels.
export const CLASSIFICACOES: ScoreClassificacao[] = ["ELITE", "MUITO_BOA", "BOA", "ATENCAO", "DESCARTE"];

export interface AnimalCarteira {
  animalId: number;
  numero: string;
  nome: string | null;
  score: number;                    // 0-100 (mesma fórmula da ficha)
  classificacao: ScoreClassificacao;
  producaoDia: number | null;       // L/dia (ResumoAnimal.producaoMediaDia)
  ccs: number | null;
  margemDiaEstimada: number | null; // R$/dia ≈ (litros×preço) − custoVacaDia − sanidade/dia
}

export interface DistribuicaoFaixa {
  classificacao: ScoreClassificacao;
  cabecas: number;
  pctRebanho: number; // 0-100, arredondado
}

export interface RankingCarteira {
  melhores: AnimalCarteira[];
  piores: AnimalCarteira[];
}

export interface AgregadoCarteira {
  totalAnimais: number;
  scoreMedio: number;               // média ponderada por produção
  distribuicao: DistribuicaoFaixa[];
  margemDiaTotal: number;
  ranking: RankingCarteira;
}

export interface SimulacaoDescarte {
  n: number;                        // clampado a [0, totalAnimais]
  cabecas: number;
  litrosDiaSai: number;
  margemDiaAntes: number;
  margemDiaDepois: number;
  margemDiaDelta: number;           // depois − antes (positivo = descarte melhora)
  ccsMedioAntes: number | null;
  ccsMedioDepois: number | null;
  scoreMedioDepois: number;
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
const num = (v: number | null): number => (v == null ? 0 : v);

// Média do score ponderada pela produção; sem produção (peso total 0) cai para
// média simples, evitando divisão por zero e ainda dando um número útil.
function scoreMedioPonderado(animais: AnimalCarteira[]): number {
  if (animais.length === 0) return 0;
  const pesoTotal = animais.reduce((s, a) => s + num(a.producaoDia), 0);
  if (pesoTotal <= 0) {
    return round(animais.reduce((s, a) => s + a.score, 0) / animais.length, 1);
  }
  const soma = animais.reduce((s, a) => s + a.score * num(a.producaoDia), 0);
  return round(soma / pesoTotal, 1);
}

// CCS médio simples sobre os animais que têm CCS (null quando ninguém tem).
function ccsMedio(animais: AnimalCarteira[]): number | null {
  const comCcs = animais.filter((a): a is AnimalCarteira & { ccs: number } => a.ccs != null);
  if (comCcs.length === 0) return null;
  return Math.round(comCcs.reduce((s, a) => s + a.ccs, 0) / comCcs.length);
}

function margemDiaTotal(animais: AnimalCarteira[]): number {
  return round(animais.reduce((s, a) => s + num(a.margemDiaEstimada), 0));
}

function distribuir(animais: AnimalCarteira[]): DistribuicaoFaixa[] {
  const total = animais.length;
  return CLASSIFICACOES.map((cls) => {
    const cabecas = animais.filter((a) => a.classificacao === cls).length;
    return { classificacao: cls, cabecas, pctRebanho: total > 0 ? Math.round((cabecas / total) * 100) : 0 };
  });
}

// Ordena por score desc (empate: maior produção primeiro) → top N.
// Piores = ordem inversa (score asc, empate por menor produção).
function montarRanking(animais: AnimalCarteira[], n: number): RankingCarteira {
  const porScoreDesc = [...animais].sort(
    (a, b) => b.score - a.score || num(b.producaoDia) - num(a.producaoDia),
  );
  const porScoreAsc = [...animais].sort(
    (a, b) => a.score - b.score || num(a.producaoDia) - num(b.producaoDia),
  );
  return { melhores: porScoreDesc.slice(0, n), piores: porScoreAsc.slice(0, n) };
}

export function agregarCarteira(animais: AnimalCarteira[], rankingN = 5): AgregadoCarteira {
  return {
    totalAnimais: animais.length,
    scoreMedio: scoreMedioPonderado(animais),
    distribuicao: distribuir(animais),
    margemDiaTotal: margemDiaTotal(animais),
    ranking: montarRanking(animais, rankingN),
  };
}

// Simula descartar as `n` piores (menor score). Recalcula margem/CCS/score do
// remanescente. Vaca de margem negativa descartada → margemDiaDelta positivo.
// Não inclui payback de reposição (fatia futura do V2).
export function simularDescarte(animais: AnimalCarteira[], n: number): SimulacaoDescarte {
  const nClamp = Math.max(0, Math.min(Math.trunc(n), animais.length));
  // As n piores por score (asc; empate por menor produção) saem.
  const porScoreAsc = [...animais].sort(
    (a, b) => a.score - b.score || num(a.producaoDia) - num(b.producaoDia),
  );
  const descartadas = porScoreAsc.slice(0, nClamp);
  const remanescente = porScoreAsc.slice(nClamp);

  const margemDiaAntes = margemDiaTotal(animais);
  const margemDiaDepois = margemDiaTotal(remanescente);
  const litrosDiaSai = round(descartadas.reduce((s, a) => s + num(a.producaoDia), 0));

  return {
    n: nClamp,
    cabecas: descartadas.length,
    litrosDiaSai,
    margemDiaAntes,
    margemDiaDepois,
    margemDiaDelta: round(margemDiaDepois - margemDiaAntes),
    ccsMedioAntes: ccsMedio(animais),
    ccsMedioDepois: ccsMedio(remanescente),
    scoreMedioDepois: scoreMedioPonderado(remanescente),
  };
}
