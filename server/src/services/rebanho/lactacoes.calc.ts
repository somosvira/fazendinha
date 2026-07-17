// Cálculo puro sobre o histórico de lactações — sem I/O, testável isoladamente.
export interface LactacaoRow {
  numero: number;
  dtInicio: Date;
  dtFim: Date | null;
  motivoSecagem: string | null;
  producaoTotal: unknown; // Prisma.Decimal | number | null (só a última lactação, via Ideagri)
  producao305: unknown;
  duracaoDias: number | null;
  producaoControles?: number | null; // derivado dos controles (TIM), quando o Ideagri não traz total
}

const DIA_MS = 86_400_000;
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA_MS);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

const dataFazenda = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Normaliza timestamp para a data civil da fazenda, representada como UTC para comparar com @db.Date. */
export function normalizarData(data: Date): Date {
  const partes = Object.fromEntries(dataFazenda.formatToParts(data).map((p) => [p.type, p.value]));
  return new Date(`${partes.year}-${partes.month}-${partes.day}T00:00:00Z`);
}

/** Produção efetiva do ciclo: valor medido do Ideagri quando existe, senão a estimativa dos controles. */
const producaoEfetiva = (l: LactacaoRow): number | null => num(l.producaoTotal) ?? l.producaoControles ?? null;

/** Duração em dias: início→fim se encerrada, senão início→hoje. */
export function duracaoLactacao(l: Pick<LactacaoRow, "dtInicio" | "dtFim">, hoje: Date): number {
  return dias(l.dtInicio, l.dtFim ?? hoje);
}

export interface ControleLeite {
  data: Date;
  pesoTotal: number;
}

export interface ProducaoCiclo {
  litros: number | null; // total estimado no ciclo; null quando não há controle na janela
  nControles: number; // controles usados na estimativa (transparência)
}

/**
 * Produção total do ciclo estimada dos controles leiteiros (Test Interval Method).
 *
 * O Ideagri só guarda o total detalhado da última lactação (`ANIMALINFO_PRODUCAO`); para as
 * anteriores derivamos dos controles `LEITE` que caem na janela [dtInicio, fim]. Método:
 *  - borda inicial (parto → 1º controle) e borda final (último controle → fim) extrapoladas flat;
 *  - interior: regra do trapézio entre controles consecutivos (dias × média dos dois pesos).
 * Com 1 só controle, colapsa em média × duração. Sem controles na janela → null (nunca inventa).
 * `fim` = dtFim da lactação encerrada, ou `hoje` para a lactação em curso.
 */
export function producaoCiclo(controles: ControleLeite[], dtInicio: Date, fim: Date): ProducaoCiclo {
  const dentro = controles
    .filter((c) => c.data.getTime() >= dtInicio.getTime() && c.data.getTime() <= fim.getTime())
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  if (dentro.length === 0) return { litros: null, nControles: 0 };

  let litros = dias(dtInicio, dentro[0].data) * dentro[0].pesoTotal; // borda inicial (flat)
  for (let i = 0; i < dentro.length - 1; i++) {
    litros += (dias(dentro[i].data, dentro[i + 1].data) * (dentro[i].pesoTotal + dentro[i + 1].pesoTotal)) / 2;
  }
  const ultimo = dentro[dentro.length - 1];
  litros += dias(ultimo.data, fim) * ultimo.pesoTotal; // borda final (flat)

  return { litros: Math.round(litros), nControles: dentro.length };
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
  // média/ciclo sobre a produção efetiva (medida do Ideagri ou estimada dos controles)
  const comProducao = lacts.map(producaoEfetiva).filter((v): v is number => v != null);
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
