import { rotuloUnidade, type UnidadeMedida } from "../../../lib/unidades";
/** Apresentação de quantidades (não dinheiro), preservando até seis casas do DTO. */
export function quantidadeNutricional(valor: string): string {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 6 }) : valor;
}

/** Rótulo da unidade como no Estoque ("KG" → "kg", "ML" → "mL"). */
export const un = (unidade: string | null | undefined) => unidade ? rotuloUnidade(unidade as UnidadeMedida) : "";
