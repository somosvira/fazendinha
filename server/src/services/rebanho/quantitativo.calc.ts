// Cálculo puro do rebanho quantitativo — sem I/O. Agrupa o efetivo ativo por categoria e faixa
// etária (a "foto" clássica do plantel). Espelha o relatório "Rebanho quantitativo" do IDEagri.

export const FAIXAS = ["0-6", "6-12", "12-24", "24-36", "36+", "sem-idade"] as const;
export type Faixa = (typeof FAIXAS)[number];

export interface AnimalQuant {
  categoria: string;
  dataNascimento: string | null; // YYYY-MM-DD ou null
}

export interface LinhaQuant {
  categoria: string;
  faixas: Record<Faixa, number>;
  totalCategoria: number;
}

export interface Quantitativo {
  linhas: LinhaQuant[]; // por total de categoria desc
  totalPorFaixa: Record<Faixa, number>;
  total: number;
}

const MS = 86_400_000;

// Idade em meses inteiros aproximados (dias/30.44). null → "sem-idade".
function faixaDe(dataNascimento: string | null, hoje: string): Faixa {
  if (!dataNascimento) return "sem-idade";
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataNascimento}T00:00:00Z`)) / MS;
  const meses = dias / 30.44;
  if (meses < 6) return "0-6";
  if (meses < 12) return "6-12";
  if (meses < 24) return "12-24";
  if (meses < 36) return "24-36";
  return "36+";
}

const faixasZeradas = (): Record<Faixa, number> => Object.fromEntries(FAIXAS.map((f) => [f, 0])) as Record<Faixa, number>;

export function agruparQuantitativo(animais: readonly AnimalQuant[], hoje: string): Quantitativo {
  const porCategoria = new Map<string, Record<Faixa, number>>();
  const totalPorFaixa = faixasZeradas();

  for (const a of animais) {
    const f = faixaDe(a.dataNascimento, hoje);
    const linha = porCategoria.get(a.categoria) ?? faixasZeradas();
    linha[f]++;
    porCategoria.set(a.categoria, linha);
    totalPorFaixa[f]++;
  }

  const linhas: LinhaQuant[] = [...porCategoria.entries()]
    .map(([categoria, faixas]) => ({ categoria, faixas, totalCategoria: FAIXAS.reduce((s, f) => s + faixas[f], 0) }))
    .sort((a, b) => b.totalCategoria - a.totalCategoria || a.categoria.localeCompare(b.categoria));

  return { linhas, totalPorFaixa, total: animais.length };
}
