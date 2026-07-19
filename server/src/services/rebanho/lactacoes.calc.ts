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
  // Correção 305 oficial (Ideagri) agregada entre ciclos — comparável entre lactações de
  // durações diferentes. Ortogonal a producaoMediaCiclo (que mistura medido + estimado TIM).
  media305: number | null;      // média dos 305 oficiais > 0; null se nenhum ciclo tem 305
  n305: number;                 // ciclos com 305 oficial > 0 (transparência da amostra)
  melhor305: number | null;     // teto produtivo 305 do animal; null se nenhum
  melhor305Numero: number | null; // ordem do ciclo campeão
}

// ── Curva de lactação (série de pontos do ciclo corrente) ────────────────────

const isoData = (d: Date) => d.toISOString().slice(0, 10);

export interface PontoCurva {
  data: string;     // ISO YYYY-MM-DD do controle
  del: number;      // dias em lactação no dia do controle (eixo X natural da curva)
  pesoTotal: number; // litros do dia (eixo Y)
}

export interface CurvaCiclo {
  numero: number | null;   // ordem da lactação do ciclo corrente; null se o animal não tem lactação
  dtInicio: string | null; // início do ciclo corrente (ISO)
  pontos: PontoCurva[];    // controles do ciclo, ordenados por data
}

/**
 * Curva de lactação do CICLO CORRENTE: a lactação aberta (`dtFim == null`), ou — se todas secas —
 * a mais recente por `dtInicio`. Filtra os controles que caem na janela [dtInicio, dtFim ?? hoje],
 * ordena por data e projeta {data, DEL, pesoTotal}. Sem lactação → série vazia; sem controle na
 * janela → identifica o ciclo mas com `pontos: []` (nunca inventa pontos).
 */
export function curvaCicloCorrente(
  lacts: Pick<LactacaoRow, "numero" | "dtInicio" | "dtFim">[],
  controles: ControleLeite[],
  hoje: Date,
): CurvaCiclo {
  if (lacts.length === 0) return { numero: null, dtInicio: null, pontos: [] };
  const aberta = lacts.find((l) => l.dtFim == null);
  const corrente = aberta ?? lacts.slice().sort((a, b) => b.dtInicio.getTime() - a.dtInicio.getTime())[0];
  const fim = corrente.dtFim ?? hoje;

  const pontos = controles
    .filter((c) => c.data.getTime() >= corrente.dtInicio.getTime() && c.data.getTime() <= fim.getTime())
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map((c) => ({ data: isoData(c.data), del: dias(corrente.dtInicio, c.data), pesoTotal: c.pesoTotal }));

  return { numero: corrente.numero, dtInicio: isoData(corrente.dtInicio), pontos };
}

export function resumoLactacoes(lacts: LactacaoRow[], hoje: Date): ResumoLactacoes {
  const aberta = lacts.find((l) => l.dtFim == null) ?? null;
  const vidaProdutivaDias = lacts.reduce((s, l) => s + duracaoLactacao(l, hoje), 0);
  // média/ciclo sobre a produção efetiva (medida do Ideagri ou estimada dos controles)
  const comProducao = lacts.map(producaoEfetiva).filter((v): v is number => v != null);
  const producaoMediaCiclo = comProducao.length
    ? Math.round(comProducao.reduce((s, v) => s + v, 0) / comProducao.length)
    : null;

  // Agregado 305 oficial: `> 0` descarta null E o sentinela 0 do Ideagri (305 ainda não
  // calculado em ciclo curto/incompleto — não é produção real de 0 L).
  const com305 = lacts
    .map((l) => ({ numero: l.numero, v: num(l.producao305) }))
    .filter((x): x is { numero: number; v: number } => x.v != null && x.v > 0);
  const n305 = com305.length;
  const media305 = n305 ? Math.round(com305.reduce((s, x) => s + x.v, 0) / n305) : null;
  // empate → menor numero (a cria mais antiga a atingir o teto); reduce é ordem-agnóstico
  const campeao = n305 ? com305.reduce((best, x) => (x.v > best.v || (x.v === best.v && x.numero < best.numero) ? x : best)) : null;

  return {
    total: lacts.length,
    emCurso: aberta != null,
    delAtual: aberta ? duracaoLactacao(aberta, hoje) : null,
    vidaProdutivaDias,
    producaoMediaCiclo,
    media305,
    n305,
    melhor305: campeao?.v ?? null,
    melhor305Numero: campeao?.numero ?? null,
  };
}
