// Cálculo puro da composição de um produto (ração formulada) — sem I/O. Soma as proporções dos
// ingredientes e diz se a receita fecha (≈100%). Espelha "Composição de produto" do IDEagri.

export interface ItemComposicao {
  proporcao: number; // % do ingrediente
}

export interface ResumoComposicaoProduto {
  soma: number; // soma das proporções (arredondada a 3 casas)
  somaOk: boolean; // true quando ~100% (tolerância ±0.5)
  nIngredientes: number;
}

const TOLERANCIA = 0.5;

export function resumoComposicao(itens: readonly ItemComposicao[]): ResumoComposicaoProduto {
  const somaBruta = itens.reduce((s, i) => s + i.proporcao, 0);
  const soma = Math.round(somaBruta * 1000) / 1000;
  return {
    soma,
    somaOk: itens.length > 0 && Math.abs(soma - 100) <= TOLERANCIA,
    nIngredientes: itens.length,
  };
}
