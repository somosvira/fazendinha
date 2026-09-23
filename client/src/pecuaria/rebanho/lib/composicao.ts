// Helpers puros de composição racial para o formulário: pré-sets em 64 avos e validação de soma.
import type { ComposicaoItemInput } from "../types";

export const PRESETS_FRACAO: { label: string; fracao64: number }[] = [
  { label: "1/2", fracao64: 32 },
  { label: "1/4", fracao64: 16 },
  { label: "3/4", fracao64: 48 },
  { label: "5/8", fracao64: 40 },
  { label: "7/8", fracao64: 56 },
];

export function somaFracoes(itens: ComposicaoItemInput[]): number {
  return itens.reduce((total, item) => total + (item.fracao64 || 0), 0);
}

export function composicaoValida(itens: ComposicaoItemInput[]): boolean {
  if (somaFracoes(itens) > 64) return false;
  const racasVistas = new Set<string>();
  for (const item of itens) {
    if (item.fracao64 < 1 || item.fracao64 > 64) return false;
    if (racasVistas.has(item.racaId)) return false;
    racasVistas.add(item.racaId);
  }
  return true;
}
