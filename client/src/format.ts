const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return brl.format(v);
}

export function moneyCell(v: number | null | undefined): { text: string; neg: boolean } {
  if (v == null || v === 0) return { text: "—", neg: false };
  return { text: brl.format(v), neg: v < 0 };
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 });
export function moneyCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  return `R$ ${compact.format(v)}`;
}

export function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
