import type { BaseFinanceira } from "./novo-api";

export function baseFinanceiraVazia(): BaseFinanceira {
  return {
    operacoes: { total: 0, estados: {}, comEstoque: 0, semParceiro: 0, semEfeitos: 0 },
    compromissos: { total: 0, estados: {} },
    transacoes: { total: 0, estados: {}, estornos: 0, avulsas: 0, comLiquidacao: 0, semMovimentos: 0, transferenciasIncompletas: 0 },
    movimentos: { total: 0, confirmados: 0, revertidos: 0, estornos: 0 },
    volumeEconomico: "0", porTipo: [], vinculosAusentes: [],
  };
}
