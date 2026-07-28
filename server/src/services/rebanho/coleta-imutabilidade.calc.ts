export function podeEditarEstrutura(input: { temEmbrioes: boolean }): boolean {
  return !input.temEmbrioes;
}

export function podeExcluirColeta(input: { temFertilizacoes: boolean; temEmbrioes: boolean }): boolean {
  return !input.temFertilizacoes && !input.temEmbrioes;
}
