// Cálculo puro dos cenários de simulação financeira — sem I/O, testável isoladamente.
// Read-only por natureza: recebe uma "base" (números REAIS já agregados do
// buildDashboard / custo vaca-dia) e devolve o cenário simulado. Nunca grava nada.
//
// Valores monetários em R$ inteiros (mesma unidade do dashboard). custoVacaDia em
// R$ (decimal). variacaoPct é um percentual (ex.: 10 = +10%, -8 = −8%).

// ── Cenário (a): preço do leite ±X% ─────────────────────────────────────────

export interface BasePrecoLeite {
  litros: number; // litros do período (estimados no dashboard)
  precoMedio: number; // R$/L médio real do período (receita ÷ litros)
  receitaLeite: number; // receita de leite real do período (R$)
  custeioLeite: number; // custeio do leite real do período (R$)
  fluxoPeriodo: number; // fluxo de caixa líquido real do período (R$)
}

export interface ResultadoPrecoLeite {
  variacaoPct: number;
  precoBase: number;
  precoSimulado: number;
  receitaLeiteBase: number;
  receitaLeiteSimulada: number;
  deltaReceita: number; // receita simulada − base
  margemLeiteBase: number; // receita − custeio (base)
  margemLeiteSimulada: number;
  fluxoPeriodoBase: number;
  fluxoPeriodoSimulado: number; // o delta de receita cai direto no fluxo (custeio não muda com o preço)
}

const round = (n: number) => Math.round(n);

/**
 * Simula uma variação percentual no preço do leite. A receita nova = litros ×
 * preço ajustado; a diferença sobre a receita atual cai direto na margem e no
 * fluxo (o custeio do leite não muda com o preço de venda).
 */
export function simularPrecoLeite(base: BasePrecoLeite, variacaoPct: number): ResultadoPrecoLeite {
  const fator = 1 + variacaoPct / 100;
  const precoSimulado = base.precoMedio * fator;
  // Receita nova ancorada nos litros × preço; se não há litros, não há receita simulada.
  const receitaLeiteSimulada = round(base.litros * precoSimulado);
  const deltaReceita = receitaLeiteSimulada - base.receitaLeite;
  const margemLeiteBase = base.receitaLeite - base.custeioLeite;
  return {
    variacaoPct,
    precoBase: base.precoMedio,
    precoSimulado,
    receitaLeiteBase: base.receitaLeite,
    receitaLeiteSimulada,
    deltaReceita,
    margemLeiteBase,
    margemLeiteSimulada: margemLeiteBase + deltaReceita,
    fluxoPeriodoBase: base.fluxoPeriodo,
    fluxoPeriodoSimulado: base.fluxoPeriodo + deltaReceita,
  };
}

// ── Cenário (b): troca de fornecedor de ração → custo vaca/dia ───────────────

export interface BaseRacao {
  custoVacaDiaAtual: number; // R$/vaca/dia real (motor do estoque)
  vacasEmLactacao: number;
  periodoDias: number; // janela usada no custo vaca/dia (ex.: 30)
}

export interface ParametrosRacao {
  variacaoPct?: number; // variação % no custo (ex.: −8 = ração 8% mais barata)
  custoVacaDiaNovo?: number; // preço absoluto por vaca/dia (sobrepõe a variação %)
}

export interface ResultadoRacao {
  custoVacaDiaAtual: number;
  custoVacaDiaSimulado: number;
  deltaVacaDia: number; // simulado − atual
  vacasEmLactacao: number;
  periodoDias: number;
  custoMensalAtual: number; // custoVacaDia × vacas × dias
  custoMensalSimulado: number;
  economiaMensal: number; // atual − simulado (positivo = economia)
}

/**
 * Simula a troca do fornecedor de ração pelo seu efeito no custo vaca/dia:
 * ou uma variação percentual, ou um preço absoluto novo por vaca/dia. O custo
 * mensal do lote = custo vaca/dia × vacas em lactação × dias da janela.
 */
export function simularTrocaRacao(base: BaseRacao, p: ParametrosRacao): ResultadoRacao {
  const custoVacaDiaSimulado =
    p.custoVacaDiaNovo != null
      ? p.custoVacaDiaNovo
      : base.custoVacaDiaAtual * (1 + (p.variacaoPct ?? 0) / 100);
  const escala = base.vacasEmLactacao * base.periodoDias;
  const custoMensalAtual = round(base.custoVacaDiaAtual * escala);
  const custoMensalSimulado = round(custoVacaDiaSimulado * escala);
  return {
    custoVacaDiaAtual: base.custoVacaDiaAtual,
    custoVacaDiaSimulado,
    deltaVacaDia: custoVacaDiaSimulado - base.custoVacaDiaAtual,
    vacasEmLactacao: base.vacasEmLactacao,
    periodoDias: base.periodoDias,
    custoMensalAtual,
    custoMensalSimulado,
    economiaMensal: custoMensalAtual - custoMensalSimulado,
  };
}
