export interface LinhaOocito {
  qualidade: string;
  viavel: boolean;
  quantidade: number;
}

type ErroOocitos = "QUALIDADE_OBRIGATORIA" | "QUANTIDADE_INVALIDA" | "COMBINACAO_DUPLICADA";

const qualidadeNormalizada = (qualidade: string) => qualidade.trim().toUpperCase();

export function validarOocitos(linhas: readonly LinhaOocito[]): { valido: boolean; erro: ErroOocitos | null } {
  const combinacoes = new Set<string>();
  for (const linha of linhas) {
    const qualidade = qualidadeNormalizada(linha.qualidade);
    if (!qualidade) return { valido: false, erro: "QUALIDADE_OBRIGATORIA" };
    if (!Number.isInteger(linha.quantidade) || linha.quantidade <= 0) return { valido: false, erro: "QUANTIDADE_INVALIDA" };
    const chave = `${qualidade}:${linha.viavel ? 1 : 0}`;
    if (combinacoes.has(chave)) return { valido: false, erro: "COMBINACAO_DUPLICADA" };
    combinacoes.add(chave);
  }
  return { valido: true, erro: null };
}

export function consolidarOocitos(linhas: readonly LinhaOocito[]): {
  total: number;
  viaveis: number;
  inviaveis: number;
  porQualidade: Record<string, number>;
} {
  const porQualidade: Record<string, number> = {};
  let viaveis = 0;
  let inviaveis = 0;
  for (const linha of linhas) {
    const qualidade = qualidadeNormalizada(linha.qualidade);
    porQualidade[qualidade] = (porQualidade[qualidade] ?? 0) + linha.quantidade;
    if (linha.viavel) viaveis += linha.quantidade;
    else inviaveis += linha.quantidade;
  }
  return { total: viaveis + inviaveis, viaveis, inviaveis, porQualidade };
}
