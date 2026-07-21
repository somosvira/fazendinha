export type ResumoLeite = { producaoDia: number | null; emLactacao: number | null; mediaVaca: number | null; tendenciaPct: number | null };
export type ResumoCaixa = { saldo: number | null; mesLabel: string | null; entrada: number | null; saida: number | null; fluxo: number | null };
export type ResumoAtencao = { chave: string; titulo: string; quantidade: number; severidade: "alta" | "media" | "baixa"; tab: string };

function registro(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null ? valor as Record<string, unknown> : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" ? valor : null;
}

function heroi(d: unknown, chave: string): Record<string, unknown> | null {
  const herois = registro(registro(d)?.herois);
  return registro(herois?.[chave]);
}

export function resumoLeite(d: unknown): ResumoLeite {
  const producao = heroi(d, "producaoTotalDia");
  return {
    producaoDia: numero(producao?.valor),
    emLactacao: numero(heroi(d, "vacasEmLactacao")?.valor),
    mediaVaca: numero(heroi(d, "producaoMediaVaca")?.valor),
    tendenciaPct: numero(producao?.variacaoPercentual),
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

function serieNumerica(valor: unknown): number[] {
  return Array.isArray(valor) ? valor.map((item) => numero(item) ?? 0) : [];
}

export function resumoCaixa(d: unknown): ResumoCaixa {
  const payload = registro(d);
  const cred = serieNumerica(payload?.creditoTotal);
  const deb = serieNumerica(payload?.debitoTotal);
  const saldo = numero(registro(payload?.caixaHoje)?.total);
  for (let i = Math.max(cred.length, deb.length) - 1; i >= 0; i--) {
    const e = cred[i] || 0, s = deb[i] || 0;
    if (e !== 0 || s !== 0) return { saldo, mesLabel: mesLabelDeIdx(i), entrada: e, saida: s, fluxo: e - s };
  }
  return { saldo, mesLabel: null, entrada: null, saida: null, fluxo: null };
}

const RANK = { alta: 0, media: 1, baixa: 2 } as const;

function alertaValido(alerta: Record<string, unknown> | null): alerta is Record<string, unknown> & ResumoAtencao {
  return alerta !== null
    && typeof alerta.chave === "string"
    && typeof alerta.titulo === "string"
    && typeof alerta.tab === "string"
    && typeof alerta.quantidade === "number"
    && alerta.quantidade > 0
    && (alerta.severidade === "alta" || alerta.severidade === "media" || alerta.severidade === "baixa");
}

export function resumoAtencao(d: unknown, max = 4): ResumoAtencao[] {
  const payload = registro(d);
  const alertas = Array.isArray(payload?.alertas) ? payload.alertas : [];
  return alertas
    .map(registro)
    .filter(alertaValido)
    .sort((a, b) => RANK[a.severidade] - RANK[b.severidade] || b.quantidade - a.quantidade)
    .slice(0, max)
    .map(({ chave, titulo, quantidade, severidade, tab }) => ({ chave, titulo, quantidade, severidade, tab }));
}
