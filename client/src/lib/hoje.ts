// Centraliza a noção de "hoje" pra todo o cliente. Antes o valor estava
// hardcoded em 5 componentes de data + 5 HOJE.ts por módulo (herança do
// protótipo com mock ancorado em 28/mai/2026). Em teste com o dono, isso
// aparecia como "Hoje" mostrando maio quando o calendário estava em julho.
//
// Regra: default = data real (`new Date()`); override opcional via
// `VITE_HOJE_ISO=YYYY-MM-DD` no build — útil para demos, screenshots e
// snapshots visuais reproduzíveis. A âncora não é usada em produção.

// Vite injeta variáveis VITE_* em `import.meta.env` no build. O tsconfig atual
// não referencia `vite/client`, então acessamos via cast pra não precisar mexer
// em toda a base de tipos.
const OVERRIDE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_HOJE_ISO ?? "").trim();

function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function getHoje(): Date {
  if (OVERRIDE) {
    const d = parseISO(OVERRIDE);
    if (d) return d;
  }
  return new Date();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" em fuso local (não usa toISOString por causa de UTC). */
export function getHojeISO(): string {
  const d = getHoje();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → "DD/MM/YYYY". */
export function formatBRDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
export function formatBRDateISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
