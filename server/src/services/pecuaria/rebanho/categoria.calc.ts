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

// ---------- categoria como filtro de banco (listagem paginada no Postgres) ----------

const DIA_MS = 86_400_000;

/**
 * Nascimento mais recente com idade ≥ `meses` em `hoje` (UTC, meia-noite). Idade é monótona no
 * nascimento, então parte da data "mesmo dia, `meses` antes" e ajusta usando a própria
 * `idadeEmMeses` — bordas de fim de mês e 29/02 ficam idênticas às de `calcularCategoria`.
 */
export function nascimentoLimiteParaIdade(hoje: Date | string, meses: number): Date {
  const h = typeof hoje === "string" ? new Date(hoje) : hoje;
  let candidato = Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - meses, h.getUTCDate()) + 4 * DIA_MS;
  while (idadeEmMeses(new Date(candidato), h) < meses) candidato -= DIA_MS;
  return new Date(candidato);
}

export interface FiltroCategoria {
  sexo: "F" | "M";
  /** true: sem partos; false: ao menos um parto; ausente: indiferente */
  semPartos?: boolean;
  /** nascimento ≤ esta data */
  nascidoAte?: Date;
  /** nascimento > esta data */
  nascidoApos?: Date;
}

/** Condições equivalentes a `calcularCategoria(...) === categoria`, para virar `where` no Prisma. */
export function filtroCategoria(categoria: CategoriaCalculada, hoje: Date | string, faixas: FaixasCategoria = FAIXAS_PADRAO): FiltroCategoria {
  const limiteBezerro = nascimentoLimiteParaIdade(hoje, faixas.mesesBezerro);
  const limiteGarrote = nascimentoLimiteParaIdade(hoje, faixas.mesesGarrote);
  switch (categoria) {
    case "VACA": return { sexo: "F", semPartos: false };
    case "BEZERRA": return { sexo: "F", semPartos: true, nascidoApos: limiteBezerro };
    case "NOVILHA": return { sexo: "F", semPartos: true, nascidoAte: limiteBezerro };
    case "BEZERRO": return { sexo: "M", nascidoApos: limiteBezerro };
    case "GARROTE": return { sexo: "M", nascidoApos: limiteGarrote, nascidoAte: limiteBezerro };
    case "TOURO": return { sexo: "M", nascidoAte: limiteGarrote };
  }
}
