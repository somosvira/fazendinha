// Espelho server-side do modelo de Acessos do front (client/src/data/acessos.ts).
// Presets de papel + checagem de permissão. Puro e testável.
export type Flag =
  | "verValores"
  | "verInvestimento"
  | "verSalarios"
  | "lancar"
  | "exportar"
  | "gerenciarAcessos";

export const AREAS_IDS = ["financeiro", "rebanho", "agricultura", "gado_corte", "equipe"] as const;
export type Area = (typeof AREAS_IDS)[number];

// `relatorio` é o identificador persistido por compatibilidade; na interface ele
// representa a Central de Relatórios geral, não apenas o antigo fechamento.
export const ABAS_IDS = ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"];
export const FLAGS_IDS: Flag[] = ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"];

export const PAPEIS: Record<string, { abas: string[]; areas: Area[]; flags: Flag[] }> = {
  proprietario: {
    abas: ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"],
    areas: [...AREAS_IDS],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
  },
  secretaria: {
    abas: ["gastos", "lancar", "caixinha", "plano", "ia"],
    areas: ["financeiro"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  contador: {
    abas: ["dashboard", "gastos", "plano", "relatorio"],
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
  return u.dono || u.areas.includes(area);
}

export function temPermissao(u: { dono: boolean; flags: string[] }, flag: Flag): boolean {
  return u.dono || u.flags.includes(flag);
}
