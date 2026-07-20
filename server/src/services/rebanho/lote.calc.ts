// Cálculo puro do status de validade de lotes de produto — sem I/O. Classifica cada lote
// (vencido / a-vencer / ok / sem-validade) e agrupa o total por status. Determinístico.

export type StatusValidade = "vencido" | "a-vencer" | "ok" | "sem-validade";

const MS = 86_400_000;
const diasEntre = (deISO: string, ateISO: string) =>
  Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / MS);

// vencido: validade < hoje. a-vencer: 0..alertaDias. ok: além. null → sem-validade.
export function statusValidade(validade: string | null, hoje: string, alertaDias = 30): StatusValidade {
  if (!validade) return "sem-validade";
  const dias = diasEntre(hoje, validade); // negativo = já venceu
  if (dias < 0) return "vencido";
  if (dias <= alertaDias) return "a-vencer";
  return "ok";
}

export interface LoteQuant { validade: string | null }

export interface ResumoLotes {
  vencido: number;
  "a-vencer": number;
  ok: number;
  "sem-validade": number;
  total: number;
}

export function agruparLotes(lotes: readonly LoteQuant[], hoje: string, alertaDias = 30): ResumoLotes {
  const r: ResumoLotes = { vencido: 0, "a-vencer": 0, ok: 0, "sem-validade": 0, total: lotes.length };
  for (const l of lotes) r[statusValidade(l.validade, hoje, alertaDias)]++;
  return r;
}
