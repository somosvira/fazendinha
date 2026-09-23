// Categoria do animal: calculada a partir de sexo, idade e partos (nunca gravada em Animal).

export type CategoriaCalculada = "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "GARROTE" | "TOURO";

export interface FaixasCategoria {
  mesesBezerro: number;
  mesesGarrote: number;
}

export const FAIXAS_PADRAO: FaixasCategoria = { mesesBezerro: 12, mesesGarrote: 24 };

export interface CalcularCategoriaInput {
  sexo: "F" | "M";
  dataNascimento: Date | string;
  partos: number;
  hoje: Date | string;
  faixas?: FaixasCategoria;
}

/** Diferença de calendário em meses completos (não é (hoje-nasc)/30). */
export function idadeEmMeses(nasc: Date | string, hoje: Date | string): number {
  const n = typeof nasc === "string" ? new Date(nasc) : nasc;
  const h = typeof hoje === "string" ? new Date(hoje) : hoje;

  let meses = (h.getUTCFullYear() - n.getUTCFullYear()) * 12 + (h.getUTCMonth() - n.getUTCMonth());
  // se o dia do mês em `hoje` ainda não alcançou o dia do nascimento, o mês corrente não completou
  if (h.getUTCDate() < n.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

export function calcularCategoria(input: CalcularCategoriaInput): CategoriaCalculada {
  const faixas = input.faixas ?? FAIXAS_PADRAO;
  const meses = idadeEmMeses(input.dataNascimento, input.hoje);

  if (input.sexo === "F") {
    if (input.partos >= 1) return "VACA";
    return meses < faixas.mesesBezerro ? "BEZERRA" : "NOVILHA";
  }

  if (meses < faixas.mesesBezerro) return "BEZERRO";
  if (meses < faixas.mesesGarrote) return "GARROTE";
  return "TOURO";
}
