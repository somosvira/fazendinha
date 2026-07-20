// Cálculo puro da composição de um medicamento a partir dos seus princípios ativos — sem I/O.
// Deriva flags no nível do PRODUTO: se é antibiótico (qualquer princípio antibiótico) e a
// carência sugerida (o máximo entre os princípios — o mais restritivo manda). Base para
// carência de leite/carne (compliance: não vender leite/abater dentro da carência).

export interface PrincipioComposicao {
  nome: string;
  ehAntibiotico: boolean;
  carenciaLeiteHoras: number | null;
  carenciaCarneDias: number | null;
}

export interface ComposicaoDerivada {
  ehAntibiotico: boolean;
  carenciaLeiteHorasSugerida: number | null;
  carenciaCarneDiasSugerida: number | null;
  principios: string[]; // nomes, na ordem de entrada
}

// Máximo ignorando nulls; null se nenhum valor.
function maxOuNull(ns: (number | null)[]): number | null {
  const validos = ns.filter((n): n is number => n != null);
  return validos.length ? Math.max(...validos) : null;
}

export function derivarComposicao(principios: readonly PrincipioComposicao[]): ComposicaoDerivada {
  return {
    ehAntibiotico: principios.some((p) => p.ehAntibiotico),
    carenciaLeiteHorasSugerida: maxOuNull(principios.map((p) => p.carenciaLeiteHoras)),
    carenciaCarneDiasSugerida: maxOuNull(principios.map((p) => p.carenciaCarneDias)),
    principios: principios.map((p) => p.nome),
  };
}
