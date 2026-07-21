export type ResumoLeite = { producaoDia: number | null; emLactacao: number | null; mediaVaca: number | null; tendenciaPct: number | null };
export type ResumoCaixa = { saldo: number | null; mesLabel: string | null; entrada: number | null; saida: number | null; fluxo: number | null };
export type ResumoAtencao = { chave: string; titulo: string; quantidade: number; severidade: "alta" | "media" | "baixa"; tab: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heroi = (d: any, k: string) => (d?.herois?.[k]?.valor ?? null) as number | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoLeite(d: any): ResumoLeite {
  return {
    producaoDia: heroi(d, "producaoTotalDia"),
    emLactacao: heroi(d, "vacasEmLactacao"),
    mediaVaca: heroi(d, "producaoMediaVaca"),
    tendenciaPct: (d?.herois?.producaoTotalDia?.variacaoPercentual ?? null) as number | null,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Âncora igual à do Dashboard financeiro: idx 0 = jul/2024.
const ANCORA_ANO = 2024, ANCORA_MES = 6;
function mesLabelDeIdx(idx: number): string {
  const mo = ANCORA_MES + idx;
  const ano = ANCORA_ANO + Math.floor(mo / 12);
  return `${MESES[((mo % 12) + 12) % 12]}/${String(ano).slice(2)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoCaixa(d: any): ResumoCaixa {
  const cred: number[] = Array.isArray(d?.creditoTotal) ? d.creditoTotal : [];
  const deb: number[] = Array.isArray(d?.debitoTotal) ? d.debitoTotal : [];
  const saldo = (d?.caixaHoje?.total ?? null) as number | null;
  for (let i = Math.max(cred.length, deb.length) - 1; i >= 0; i--) {
    const e = cred[i] || 0, s = deb[i] || 0;
    if (e !== 0 || s !== 0) return { saldo, mesLabel: mesLabelDeIdx(i), entrada: e, saida: s, fluxo: e - s };
  }
  return { saldo, mesLabel: null, entrada: null, saida: null, fluxo: null };
}

const RANK = { alta: 0, media: 1, baixa: 2 } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoAtencao(d: any, max = 4): ResumoAtencao[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alertas: any[] = Array.isArray(d?.alertas) ? d.alertas : [];
  return alertas
    .filter((a) => (a?.quantidade ?? 0) > 0)
    .sort((a, b) => RANK[a.severidade as keyof typeof RANK] - RANK[b.severidade as keyof typeof RANK] || b.quantidade - a.quantidade)
    .slice(0, max)
    .map((a) => ({ chave: a.chave, titulo: a.titulo, quantidade: a.quantidade, severidade: a.severidade, tab: a.tab }));
}
