import type { Talhao } from "../types";

/* Derivações simples — densidade e idade do talhão. */

export function idadeAnos(t: Talhao, hojeIso: string): number {
  const hoje = new Date(hojeIso).getTime();
  const plant = new Date(t.dataPlantio).getTime();
  return Math.max(0, Math.floor((hoje - plant) / (365.25 * 86_400_000)));
}

/* Categoria simbólica para classificar o talhão na ficha. */
export function categoriaIdade(idade: number): string {
  if (idade < 1) return "MUDA";
  if (idade < 3) return "FORMAÇÃO";
  if (idade < 8) return "JOVEM";
  if (idade < 15) return "PRODUTIVO";
  return "ANTIGO";
}

/* Estimativa de plantas totais do talhão. */
export function totalPlantas(t: Talhao): number {
  return Math.round(t.plantasHa * t.areaHa);
}

/* Tons editoriais para a pílula de fase fenológica. */
export function tomFase(fase: string): "" | "warn" | "bad" | "ok" {
  if (fase === "COLHEITA") return "ok";
  if (fase === "MATURACAO_CEREJA") return "ok";
  if (fase === "FLORADA" || fase === "CHUMBINHO") return "warn"; // momento sensível
  return "";
}
