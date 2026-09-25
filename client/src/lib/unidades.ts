// Espelha server/src/services/estoque/unidades.ts — mesmas chaves, rótulos e
// fatores (mesma base). Mantido literal (sem importar do server) porque client
// e server são pacotes separados; um teste (unidades.test.ts) garante que as
// duas listas continuam batendo.
export type UnidadeMedida = "UN" | "KG" | "G" | "T" | "L" | "ML" | "SC" | "DOSE" | "CX" | "M" | "HA";

export const UNIDADES: Record<UnidadeMedida, { rotulo: string; nomeLongo: string; base: UnidadeMedida; fator: number }> = {
  UN: { rotulo: "un", nomeLongo: "unidade", base: "UN", fator: 1 },
  KG: { rotulo: "kg", nomeLongo: "quilograma", base: "KG", fator: 1 },
  G: { rotulo: "g", nomeLongo: "grama", base: "KG", fator: 0.001 },
  T: { rotulo: "t", nomeLongo: "tonelada", base: "KG", fator: 1000 },
  L: { rotulo: "L", nomeLongo: "litro", base: "L", fator: 1 },
  ML: { rotulo: "mL", nomeLongo: "mililitro", base: "L", fator: 0.001 },
  SC: { rotulo: "sc", nomeLongo: "saco", base: "SC", fator: 1 },
  DOSE: { rotulo: "dose", nomeLongo: "dose", base: "DOSE", fator: 1 },
  CX: { rotulo: "cx", nomeLongo: "caixa", base: "CX", fator: 1 },
  M: { rotulo: "m", nomeLongo: "metro", base: "M", fator: 1 },
  HA: { rotulo: "ha", nomeLongo: "hectare", base: "HA", fator: 1 },
};

export const UNIDADES_ORDENADAS: UnidadeMedida[] = ["UN", "KG", "G", "T", "L", "ML", "SC", "DOSE", "CX", "M", "HA"];

export function rotuloUnidade(unidade: UnidadeMedida): string {
  return UNIDADES[unidade]?.rotulo ?? unidade;
}

export function nomeLongoUnidade(unidade: UnidadeMedida): string {
  return UNIDADES[unidade]?.nomeLongo ?? unidade;
}

export function rotuloUnidadeCompleto(unidade: UnidadeMedida): string {
  return `${rotuloUnidade(unidade)} — ${nomeLongoUnidade(unidade)}`;
}

export function mesmaBase(a: UnidadeMedida, b: UnidadeMedida): boolean {
  return UNIDADES[a].base === UNIDADES[b].base;
}

// Converte um valor entre unidades da mesma base; lança erro claro se as bases
// forem diferentes (ex.: mL → kg).
export function converterQuantidade(valor: number, de: UnidadeMedida, para: UnidadeMedida): number {
  if (!mesmaBase(de, para)) {
    throw new Error(`Não é possível converter de ${rotuloUnidade(de)} para ${rotuloUnidade(para)} — unidades de base diferente`);
  }
  if (de === para) return valor;
  return (valor * UNIDADES[de].fator) / UNIDADES[para].fator;
}
