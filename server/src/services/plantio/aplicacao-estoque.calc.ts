// Cálculo puro: decide se uma operação agrícola (adubação/aplicação) deve gerar
// baixa de estoque (SAIDA) e monta a quantidade total consumida. Espelha
// rebanho/sanidade-estoque.calc.ts. Sem I/O.
//
// A dose (doseValor/doseUnidade) é sempre lançada na unidade do produto do
// estoque — quando a unidade termina em "/ha" (ex.: "L/ha", "kg/ha") o total é
// dose × área do talhão; quando não (dose já é o total aplicado), usa a dose
// como veio. Não há conversão entre unidades (kg↔L, g↔kg etc.) — a unidade do
// produto cadastrado é a que vale.

export interface PlanejarBaixaAplicacaoIn {
  produtoId: number | null | undefined;
  estocavel: boolean;
  doseValor: number | null | undefined;
  doseUnidade: string | null | undefined;
  areaHa: number | null | undefined;
  quantidadeTotalInformada?: number | null;
}

export interface PlanejarBaixaAplicacaoOut {
  quantidade: number;
  deveBaixar: boolean;
}

export function planejarBaixaAplicacao(input: PlanejarBaixaAplicacaoIn): PlanejarBaixaAplicacaoOut {
  const porHectare = (input.doseUnidade ?? "").trim().toLowerCase().endsWith("/ha");
  let quantidade = 0;
  if (input.quantidadeTotalInformada != null) {
    quantidade = input.quantidadeTotalInformada;
  } else if (input.doseValor != null) {
    quantidade = porHectare ? input.doseValor * (input.areaHa ?? 0) : input.doseValor;
  }
  quantidade = Math.round(quantidade * 1000) / 1000;
  const deveBaixar = !!input.produtoId && input.estocavel && quantidade > 0;
  return { quantidade, deveBaixar };
}
