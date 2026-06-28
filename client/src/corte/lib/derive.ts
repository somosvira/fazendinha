import type { Lote, ResumoLote, CategoriaLote } from "../types";
import { CATEGORIA_LABEL, KG_POR_ARROBA, RENDIMENTO_CARCACA } from "../types";

export const KG_POR_UA = 450;
export function toUA(pesoMedio: number, numCabecas: number): number {
  return (pesoMedio * numCabecas) / KG_POR_UA;
}

export function arrobasCarcaca(pesoKg: number, rendimento = RENDIMENTO_CARCACA): number {
  return (pesoKg * rendimento) / KG_POR_ARROBA;
}

export function idadeMesesAprox(lote: Lote, hojeIso: string): number {
  const dias = (new Date(hojeIso).getTime() - new Date(lote.dataFormacao).getTime()) / 86_400_000;
  return Math.round(dias / 30.4);
}

/* GMD esperado por categoria (Embrapa Gado de Corte / cronograma 11).
 * Calibrado para sistema pasto Sul de Minas — confinamento desvia pra cima. */
export const GMD_ESPERADO: Record<CategoriaLote, number> = {
  BEZERRO_MAMA: 0.55,
  BEZERRA_MAMA: 0.50,
  BEZERRO_DESMAMA: 0.45,
  BEZERRA_DESMAMA: 0.42,
  GAROTE: 0.55,
  NOVILHA: 0.48,
  NOVILHO: 0.65,
  BOI_GORDO: 0.45,
  VACA_MATRIZ: 0.0,    // manutenção
  TOURO: 0.0,
  VACA_DESCARTE: 0.65,
};

export function gmdAbaixoEsperado(resumo: ResumoLote, lote: Lote): boolean {
  const esperado = GMD_ESPERADO[lote.categoria];
  return (resumo.gmd ?? 0) < esperado * 0.9; // 10% de tolerância
}

export function labelCategoria(c: CategoriaLote): string {
  return CATEGORIA_LABEL[c];
}

/* Mortalidade acumulada calculada a partir das cabeças de entrada vs atuais. */
export function mortalidadeAcumulada(lote: Lote): number {
  if (lote.numCabecasEntrada === 0) return 0;
  return ((lote.numCabecasEntrada - lote.numCabecas) / lote.numCabecasEntrada) * 100;
}
