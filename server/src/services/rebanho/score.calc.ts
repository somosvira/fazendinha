// Motor puro do score do animal (Prisma-free, testado por TDD).
// Extraído de insights.ts (Abordagem A do design da Carteira): as funções de
// pontuação, `classificar` e o agregador `scoreDoResumo` vivem aqui para serem
// reusadas tanto pela ficha (obterInsights) quanto pela varredura da Carteira,
// sem chamar obterInsights N vezes. Refactor comportamento-preservador — os
// números não mudam (garantido por score.calc.test.ts).

export type ScoreClassificacao = "ELITE" | "MUITO_BOA" | "BOA" | "ATENCAO" | "DESCARTE";
export interface ScoreFatorDTO { nome: string; pontos: number; peso: number }
export interface ScoreDTO {
  valor: number; // 0-100
  classificacao: ScoreClassificacao;
  estrelas: 1 | 2 | 3 | 4 | 5;
  fatores: ScoreFatorDTO[];
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// ── Fatores (0-120; produção pode passar de 100 quando bate a meta) ──────────

export function pontosProducao(produzido: number | null, meta: number | null): number {
  if (produzido == null || meta == null || meta === 0) return 50;
  return Math.min(120, Math.round((produzido / meta) * 100));
}

export function pontosCCS(ccs: number | null): number {
  if (ccs == null) return 50;
  if (ccs <= 200) return 100;
  if (ccs <= 400) return 70;
  if (ccs <= 750) return 40;
  return 10;
}

export function pontosFertilidade(statusReprod: string | null, iep: number | null): number {
  if (statusReprod === "PRENHE") return 90;
  if (iep == null) return 60;
  if (iep <= 380) return 100;
  if (iep <= 420) return 75;
  return 40;
}

export function pontosIdade(idade: number | null, prime: { min: number; max: number }): number {
  if (idade == null) return 60;
  if (idade >= prime.min && idade <= prime.max) return 100;
  if (idade < prime.min) return 80;
  if (idade <= prime.max + 2) return 75;
  return 50;
}

export function pontosSaude(ocorrenciasRecentes: number): number {
  if (ocorrenciasRecentes === 0) return 100;
  return Math.max(20, 80 - ocorrenciasRecentes * 15);
}

export function pontosRentab(margem: number | null): number {
  if (margem == null) return 50;
  if (margem >= 0.30) return 100;
  if (margem >= 0.15) return 75;
  if (margem >= 0) return 50;
  return 20;
}

export function classificar(valor: number): { classificacao: ScoreClassificacao; estrelas: 1 | 2 | 3 | 4 | 5 } {
  if (valor >= 85) return { classificacao: "ELITE", estrelas: 5 };
  if (valor >= 70) return { classificacao: "MUITO_BOA", estrelas: 4 };
  if (valor >= 55) return { classificacao: "BOA", estrelas: 3 };
  if (valor >= 40) return { classificacao: "ATENCAO", estrelas: 2 };
  return { classificacao: "DESCARTE", estrelas: 1 };
}

// ── Agregador ────────────────────────────────────────────────────────────────

// Insumos já materializados (o caller resolve resumo/meta/idade/margem/ocorrências).
// Pesos: Produção 30, CCS 20, Fertilidade 20, Idade 10, Saúde 10, Rentabilidade 10.
export interface ScoreInsumos {
  producaoMediaDia: number | null;
  metaProducao: number | null;
  ccs: number | null;
  statusReprodutivo: string | null;
  iepProjetado: number | null;
  idadeAnos: number | null;
  prime: { min: number; max: number };
  ocorrenciasRecentes: number;
  margem: number | null; // 0-1; null quando não há receita p/ estimar
}

export function scoreDoResumo(insumos: ScoreInsumos): ScoreDTO {
  const fatores: ScoreFatorDTO[] = [
    { nome: "Produção",      pontos: pontosProducao(insumos.producaoMediaDia, insumos.metaProducao), peso: 30 },
    { nome: "CCS",           pontos: pontosCCS(insumos.ccs), peso: 20 },
    { nome: "Fertilidade",   pontos: pontosFertilidade(insumos.statusReprodutivo, insumos.iepProjetado), peso: 20 },
    { nome: "Idade",         pontos: pontosIdade(insumos.idadeAnos, insumos.prime), peso: 10 },
    { nome: "Saúde",         pontos: pontosSaude(insumos.ocorrenciasRecentes), peso: 10 },
    { nome: "Rentabilidade", pontos: pontosRentab(insumos.margem), peso: 10 },
  ];
  const valorBruto = round(fatores.reduce((s, f) => s + (f.pontos * f.peso) / 100, 0), 0);
  const cls = classificar(valorBruto);
  return { valor: Math.min(100, valorBruto), ...cls, fatores };
}
