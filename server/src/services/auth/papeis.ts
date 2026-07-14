// Espelho server-side do modelo de Acessos do front (client/src/data/acessos.ts).
// Presets de papel + checagem de permissão. Puro e testável.
export type Flag =
  | "verValores"
  | "verInvestimento"
  | "verSalarios"
  | "lancar"
  | "exportar"
  | "gerenciarAcessos";

export const ABAS_IDS = ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"];
export const FLAGS_IDS: Flag[] = ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"];

export const PAPEIS: Record<string, { abas: string[]; flags: Flag[] }> = {
  proprietario: {
    abas: ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
  },
  secretaria: {
    abas: ["gastos", "lancar", "caixinha", "plano", "ia"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  contador: {
    abas: ["dashboard", "gastos", "plano", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "exportar"],
  },
  gestor: {
    abas: ["dashboard", "gastos", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
  consulta: {
    abas: ["dashboard", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
};

export function aplicarPreset(papel: string): { abas: string[]; flags: Flag[] } {
  const p = PAPEIS[papel];
  return p ? { abas: [...p.abas], flags: [...p.flags] } : { abas: [], flags: [] };
}

export function temPermissao(u: { dono: boolean; flags: string[] }, flag: Flag): boolean {
  return u.dono || u.flags.includes(flag);
}
