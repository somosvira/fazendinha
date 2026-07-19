// Simulação financeira (read-only): monta a base com números REAIS do dashboard
// e do custo vaca/dia, delega o cálculo à parte pura (simulacao.calc.ts) e devolve
// baseline + cenário. NÃO grava Lancamento nem toca FechamentoMensal.

import { buildDashboard } from "./dashboard.js";
import { calcularCustoVacaDia } from "./rebanho/estoque.js";
import {
  simularPrecoLeite, simularTrocaRacao,
  type BasePrecoLeite, type BaseRacao, type ParametrosRacao,
  type ResultadoPrecoLeite, type ResultadoRacao,
} from "./simulacao.calc.js";

export interface CenarioPrecoLeite {
  base: BasePrecoLeite;
  resultado: ResultadoPrecoLeite;
}

// Preço do leite ±X%: ancora nos litros/preço/receita/custeio REAIS do YTD 2026
// (mesmo recorte dos KPIs de R$/L do dashboard) e no fluxo total da janela.
export async function simularCenarioPrecoLeite(variacaoPct: number, propriedadeId?: number | null): Promise<CenarioPrecoLeite> {
  const d = await buildDashboard({ propriedadeId });
  const base: BasePrecoLeite = {
    litros: d.volumes.litrosLeiteYTD ?? 0,
    precoMedio: d.volumes.precoMedioLeiteYTD ?? 0,
    receitaLeite: d.k2026YTD.receitaLeite,
    custeioLeite: d.k2026YTD.custeioLeitePuro,
    // Fluxo de referência: fluxo líquido total da janela de 23 meses (totalGeral).
    fluxoPeriodo: d.totals23m.totalGeral,
  };
  return { base, resultado: simularPrecoLeite(base, variacaoPct) };
}

export interface CenarioRacao {
  base: BaseRacao;
  resultado: ResultadoRacao;
}

// Troca de fornecedor de ração → custo vaca/dia: usa o motor real de custo vaca/dia
// (consumo de insumo ÷ vacas×dias) como base e simula a variação/preço novo.
export async function simularCenarioRacao(p: ParametrosRacao, periodoDias = 30, propriedadeId?: number | null): Promise<CenarioRacao> {
  const cvd = await calcularCustoVacaDia(periodoDias, propriedadeId);
  const base: BaseRacao = {
    // custoVacaDia é null quando não há vacas em lactação; nesse caso o custo é 0.
    custoVacaDiaAtual: cvd.custoVacaDia ?? 0,
    vacasEmLactacao: cvd.vacasEmLactacao,
    periodoDias: cvd.periodoDias,
  };
  return { base, resultado: simularTrocaRacao(base, p) };
}
