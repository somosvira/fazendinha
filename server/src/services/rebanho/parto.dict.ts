// Dicionários oficiais do IDEAGRI (TIPOPARTO / AUXILIOPARTO) — fonte DADOS777.
// Códigos são strings estáveis para sobreviver a import + UI sem inventar IDs.

export const TIPOS_PARTO = [
  { codigo: "1", sigla: "NO", label: "Normal" },
  { codigo: "2", sigla: "AX", label: "Auxiliado" },
  { codigo: "3", sigla: "AB", label: "Aborto" },
  { codigo: "4", sigla: "NT", label: "Natimorto" },
  { codigo: "5", sigla: "IN", label: "Induzido" },
  { codigo: "6", sigla: "PR", label: "Prematuro" },
  { codigo: "7", sigla: "VN", label: "Vivo/Natimorto" },
] as const;

export const AUXILIOS_PARTO = [
  { codigo: "4", sigla: "IN", label: "1-Introdução de mãos" },
  { codigo: "1", sigla: "BP", label: "2-Bezerro puxado" },
  { codigo: "3", sigla: "CP", label: "3-Complicado" },
  { codigo: "2", sigla: "CS", label: "4-Cesariana" },
] as const;

export type CodigoTipoParto = (typeof TIPOS_PARTO)[number]["codigo"];
export type CodigoAuxilioParto = (typeof AUXILIOS_PARTO)[number]["codigo"];

const CODIGOS_TIPO = new Set(TIPOS_PARTO.map((t) => t.codigo));
const CODIGOS_AUX = new Set(AUXILIOS_PARTO.map((a) => a.codigo));

// Aceita código IDEAGRI ("1") ou rótulos legados do app ("normal"/"distocia"/"cesarea").
const LEGADO_TIPO: Record<string, CodigoTipoParto> = {
  normal: "1",
  distocia: "2",
  cesarea: "2", // cesárea legada vira Auxiliado + auxilio CS
  auxiliado: "2",
  aborto: "3",
  natimorto: "4",
  induzido: "5",
  prematuro: "6",
};

const LEGADO_AUX: Record<string, CodigoAuxilioParto> = {
  cesarea: "2",
  cesárea: "2",
  distocia: "1",
};

export function normalizarTipoParto(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const v = raw.trim();
  if (CODIGOS_TIPO.has(v as CodigoTipoParto)) return v;
  const leg = LEGADO_TIPO[v.toLowerCase()];
  return leg ?? v.slice(0, 20);
}

export function normalizarAuxilioParto(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const v = raw.trim();
  if (CODIGOS_AUX.has(v as CodigoAuxilioParto)) return v;
  const leg = LEGADO_AUX[v.toLowerCase()];
  return leg ?? v.slice(0, 20);
}

export function labelTipoParto(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return TIPOS_PARTO.find((t) => t.codigo === codigo)?.label
    ?? TIPOS_PARTO.find((t) => t.sigla === codigo)?.label
    ?? codigo;
}

export function labelAuxilioParto(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return AUXILIOS_PARTO.find((a) => a.codigo === codigo)?.label
    ?? AUXILIOS_PARTO.find((a) => a.sigla === codigo)?.label
    ?? codigo;
}

export function ehAborto(tipoParto: string | null | undefined): boolean {
  return normalizarTipoParto(tipoParto) === "3";
}

export function ehNatimortoTotal(tipoParto: string | null | undefined): boolean {
  return normalizarTipoParto(tipoParto) === "4";
}

/** Deriva vivos/natimortos a partir do dicionário quando o fato não traz split explícito. */
export function derivarCrias(
  tipoParto: string | null | undefined,
  numCrias: number | null | undefined,
  criasVivas: number | null | undefined,
  criasNatimortas: number | null | undefined,
): { vivos: number | null; natimortos: number | null } {
  if (criasVivas != null || criasNatimortas != null) {
    return { vivos: criasVivas ?? 0, natimortos: criasNatimortas ?? 0 };
  }
  const n = numCrias ?? null;
  if (n == null) return { vivos: null, natimortos: null };
  const t = normalizarTipoParto(tipoParto);
  if (t === "3") return { vivos: 0, natimortos: 0 }; // aborto: gestação interrompida, sem cria a termo
  if (t === "4") return { vivos: 0, natimortos: n };
  if (t === "7") return { vivos: null, natimortos: null }; // misto sem split — desconhecido
  return { vivos: n, natimortos: 0 };
}
