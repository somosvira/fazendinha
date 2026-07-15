// Cálculo puro sobre o histórico de lactações — sem I/O, testável isoladamente.
export interface LactacaoRow {
  numero: number;
  dtInicio: Date;
  dtFim: Date | null;
  motivoSecagem: string | null;
  producaoTotal: unknown; // Prisma.Decimal | number | null
  producao305: unknown;
  duracaoDias: number | null;
}

const DIA_MS = 86_400_000;
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA_MS);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Duração em dias: início→fim se encerrada, senão início→hoje. */
export function duracaoLactacao(l: Pick<LactacaoRow, "dtInicio" | "dtFim">, hoje: Date): number {
  return dias(l.dtInicio, l.dtFim ?? hoje);
}

export interface ResumoLactacoes {
  total: number;
  emCurso: boolean;
  delAtual: number | null;
  vidaProdutivaDias: number;
  producaoMediaCiclo: number | null;
}

export function resumoLactacoes(lacts: LactacaoRow[], hoje: Date): ResumoLactacoes {
  const aberta = lacts.find((l) => l.dtFim == null) ?? null;
  const vidaProdutivaDias = lacts.reduce((s, l) => s + duracaoLactacao(l, hoje), 0);
  const comProducao = lacts.map((l) => num(l.producaoTotal)).filter((v): v is number => v != null);
  const producaoMediaCiclo = comProducao.length
    ? Math.round(comProducao.reduce((s, v) => s + v, 0) / comProducao.length)
    : null;
  return {
    total: lacts.length,
    emCurso: aberta != null,
    delAtual: aberta ? duracaoLactacao(aberta, hoje) : null,
    vidaProdutivaDias,
    producaoMediaCiclo,
  };
}
