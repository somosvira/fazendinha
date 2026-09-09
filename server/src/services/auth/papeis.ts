// Espelho server-side do modelo de Acessos do front (client/src/data/acessos.ts).
// Presets de papel + checagem de permissão. Puro e testável.
export type Flag =
  | "verValores"
  | "verInvestimento"
  | "verSalarios"
  | "lancar"
  | "exportar"
  | "gerenciarAcessos";

export const AREAS_IDS = ["financeiro", "pecuaria", "agricultura", "equipe"] as const;
export type Area = (typeof AREAS_IDS)[number];
const AREAS_LEGADAS_PECUARIA = new Set(["rebanho", "gado_corte"]);

// `relatorio` é o identificador persistido por compatibilidade; na interface ele
// representa a Central de Relatórios geral, não apenas o antigo fechamento.
export const ABAS_IDS = ["dashboard", "gastos", "lancar", "caixinha", "cadastros", "relatorio"];
export const FLAGS_IDS: Flag[] = ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"];

export const PAPEIS: Record<string, { abas: string[]; areas: Area[]; flags: Flag[] }> = {
  proprietario: {
    abas: ["dashboard", "gastos", "lancar", "caixinha", "cadastros", "relatorio"],
    areas: [...AREAS_IDS],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
  },
  secretaria: {
    abas: ["gastos", "lancar", "caixinha", "cadastros"],
    areas: ["financeiro"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  contador: {
    abas: ["dashboard", "gastos", "caixinha", "cadastros", "relatorio"],
    areas: ["financeiro"],
    flags: ["verValores", "verInvestimento", "verSalarios", "exportar"],
  },
  gestor: {
    abas: ["dashboard", "gastos", "ia", "relatorio"],
    areas: [...AREAS_IDS],
    flags: ["verValores", "verInvestimento"],
  },
  consulta: {
    abas: ["dashboard", "relatorio"],
    areas: ["financeiro"],
    flags: ["verValores", "verInvestimento"],
  },
};

export function aplicarPreset(papel: string): { abas: string[]; areas: Area[]; flags: Flag[] } {
  const p = PAPEIS[papel];
  return p ? { abas: [...p.abas], areas: [...p.areas], flags: [...p.flags] } : { abas: [], areas: [], flags: [] };
}

export function temArea(u: { dono: boolean; areas: string[] }, area: Area): boolean {
  if (u.dono || u.areas.includes(area)) return true;
  return area === "pecuaria" && u.areas.some((id) => AREAS_LEGADAS_PECUARIA.has(id));
}

/** Normaliza permissões persistidas antes da unificação da pecuária. */
export function normalizarAreas(areas: string[]): Area[] {
  const resultado = new Set<Area>();
  for (const area of areas) {
    if (AREAS_LEGADAS_PECUARIA.has(area)) resultado.add("pecuaria");
    else if ((AREAS_IDS as readonly string[]).includes(area)) resultado.add(area as Area);
  }
  return [...resultado];
}

export function temPermissao(u: { dono: boolean; flags: string[] }, flag: Flag): boolean {
  return u.dono || u.flags.includes(flag);
}
