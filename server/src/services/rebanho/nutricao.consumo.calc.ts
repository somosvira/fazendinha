// Motor puro de consumo de dieta (Prisma-free, testado por TDD).
// consumo esperado = qtd/cabeça/dia × cabeças × dias. Sem datas, sem DB —
// o service resolve cabeças/dias e persiste as SAIDAs.

export interface ItemConsumo {
  produtoId: string;
  qtdPorCabecaDia: number;
}

export interface LinhaConsumo {
  produtoId: string;
  quantidade: number;
}

// Multiplica cada item por cabeças × dias. Arredonda a 4 casas para conter
// ruído de ponto flutuante (a SAIDA persiste em Decimal(12,2)).
export function consumoEsperado(itens: ItemConsumo[], numCabecas: number, dias: number): LinhaConsumo[] {
  if (numCabecas < 0 || dias < 0) throw new Error("cabeças e dias não podem ser negativos");
  return itens.map((it) => ({
    produtoId: it.produtoId,
    quantidade: Math.round(it.qtdPorCabecaDia * numCabecas * dias * 10000) / 10000,
  }));
}

// Dias no período, inclusivo nas duas pontas (mesmo dia = 1). Datas ISO "YYYY-MM-DD".
export function diasNoPeriodo(dataInicio: string, dataFim: string): number {
  const ini = new Date(dataInicio + "T00:00:00Z").getTime();
  const fim = new Date(dataFim + "T00:00:00Z").getTime();
  const dias = Math.floor((fim - ini) / 86_400_000) + 1;
  return dias > 0 ? dias : 0;
}
