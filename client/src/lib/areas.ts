import type { Tab } from "../components/Shell";

export const TODAS_AREAS = ["financeiro", "rebanho", "agricultura", "gado_corte", "equipe"] as const;
export type AreaId = (typeof TODAS_AREAS)[number];

const FINANCEIRO = new Set<Tab>(["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio", "cadastros"]);

export function areaDaTab(tab: Tab): AreaId | null {
  const id = String(tab);
  if (id.startsWith("reb-")) return "rebanho";
  if (id.startsWith("pla-") || id.startsWith("mil-")) return "agricultura";
  if (id.startsWith("cor-")) return "gado_corte";
  if (id.startsWith("eqp-")) return "equipe";
  return FINANCEIRO.has(tab) ? "financeiro" : null;
}

export function temAcessoArea(areas: string[] | undefined, area: AreaId, dono = false): boolean {
  // Compatibilidade com sessões gravadas antes da introdução de `areas`.
  return dono || !areas || areas.includes(area);
}
