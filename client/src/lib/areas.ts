import type { Tab } from "../components/Shell";

export const TODAS_AREAS = ["financeiro", "pecuaria", "agricultura", "equipe"] as const;
export type AreaId = (typeof TODAS_AREAS)[number];

const AREAS_LEGADAS_PECUARIA = new Set(["rebanho", "gado_corte"]);

const FINANCEIRO = new Set<Tab>(["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio", "cadastros"]);

export function areaDaTab(tab: Tab): AreaId | null {
  const id = String(tab);
  if (id.startsWith("pla-") || id.startsWith("mil-")) return "agricultura";
  if (id.startsWith("pec-")) return "pecuaria";
  if (id.startsWith("eqp-")) return "equipe";
  return FINANCEIRO.has(tab) ? "financeiro" : null;
}

export function temAcessoArea(areas: string[] | undefined, area: AreaId, dono = false): boolean {
  // Compatibilidade com sessões gravadas antes da introdução de `areas`.
  if (dono || !areas || areas.includes(area)) return true;
  return area === "pecuaria" && areas.some((id) => AREAS_LEGADAS_PECUARIA.has(id));
}

/** Converte a antiga divisão Rebanho/Gado de corte para a área única Pecuária. */
export function normalizarAreas(areas: string[] | undefined): AreaId[] | undefined {
  if (!areas) return undefined;
  const resultado = new Set<AreaId>();
  for (const area of areas) {
    if (AREAS_LEGADAS_PECUARIA.has(area)) resultado.add("pecuaria");
    else if ((TODAS_AREAS as readonly string[]).includes(area)) resultado.add(area as AreaId);
  }
  return [...resultado];
}
