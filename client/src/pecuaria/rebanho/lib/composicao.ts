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

export function juntarComposicoes(herdada: ComposicaoItemInput[], informada: ComposicaoItemInput[]): ComposicaoItemInput[] {
  const mapa = new Map<string, number>();
  for (const item of [...herdada, ...informada]) {
    if (item.racaId && item.fracao64 > 0) mapa.set(item.racaId, (mapa.get(item.racaId) ?? 0) + item.fracao64);
  }
  return [...mapa].map(([racaId, fracao64]) => ({ racaId, fracao64 }));
}

export function parcelaInformada(total: ComposicaoItemInput[], herdada: ComposicaoItemInput[]): ComposicaoItemInput[] {
  const fixa = new Map(herdada.map((item) => [item.racaId, item.fracao64]));
  return total.map((item) => ({ ...item, fracao64: item.fracao64 - (fixa.get(item.racaId) ?? 0) })).filter((item) => item.fracao64 > 0);
}

export function respeitaHerdanca(total: ComposicaoItemInput[], herdada: ComposicaoItemInput[]): boolean {
  const mapa = new Map(total.map((item) => [item.racaId, item.fracao64]));
  return herdada.every((item) => (mapa.get(item.racaId) ?? 0) >= item.fracao64);
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

// Fração em 64 avos como fração reduzida ("48" → "3/4", "64" → "1/1").
export function fracaoReduzida(fracao64: number): string {
  let a = fracao64, b = 64;
  while (b) [a, b] = [b, a % b];
  const mdc = a || 1;
  return `${fracao64 / mdc}/${64 / mdc}`;
}
