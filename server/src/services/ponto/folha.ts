/* Motor de apuração de folha/ponto — núcleo PURO (sem DB), testável.
 *
 * Espelha a forma dos engines puros do corte (resumos.recompute.ts) e do
 * plantio: matemática financeira com Prisma.Decimal, DTO devolve Number.
 *
 * Regra de hora extra (prática, aprovada no design 2026-07-01):
 *   - horas do dia = ((saída − entrada) em minutos − intervaloMin) / 60, ≥ 0.
 *   - UTIL:            normais = min(horas, jornada); extra50 = max(0, horas − jornada); extra100 = 0.
 *   - DOMINGO/FERIADO: normais = 0; extra50 = 0; extra100 = todas as horas (100%).
 *   - FOLGA/FALTA:     tudo zero.
 *   - valorHora = salarioMensal ÷ cargaMensalHoras.
 *   - valorExtra = extra50 × valorHora × 1,5 + extra100 × valorHora × 2.
 *   - totalPagar = salarioMensal + valorExtra.
 */
import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;

/** Arredonda para 2 casas (dinheiro/horas do DTO). Exportado — o service reusa
 * para manter a mesma precisão do motor puro (Decimal.toFixed em vez de float). */
export const round2 = (v: Prisma.Decimal | number): number => Number(new D(v).toFixed(2));

export interface RegistroInput {
  entrada?: string | null; // "HH:MM"
  saida?: string | null; // "HH:MM"
  intervaloMin: number; // minutos
  tipoDia: string; // UTIL/DOMINGO/FERIADO/FOLGA/FALTA
}

export interface FuncionarioInput {
  id: string;
  nome: string;
  cargo: string | null;
  salarioMensal: number;
  cargaMensalHoras: number;
  jornadaDiariaHoras: number;
}

export interface ApuracaoDia {
  horas: number;
  normais: number;
  extra50: number;
  extra100: number;
}

export interface FolhaLinhaDTO {
  funcionarioId: string;
  nome: string;
  cargo: string | null;
  salarioMensal: number;
  valorHora: number;
  diasTrabalhados: number;
  totalHoras: number;
  horasNormais: number;
  extra50: number;
  extra100: number;
  valorExtra: number;
  totalPagar: number;
}

/** "HH:MM" → minutos desde 00:00, ou null se ausente/malformado. Casa com o
 * schema Zod de pontos (`/^\d{2}:\d{2}$/`) — "7:00" é rejeitado nos dois lados. */
function paraMinutos(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Horas trabalhadas no dia. FOLGA/FALTA ou sem entrada|saída → 0. Clamp ≥ 0. */
export function horasDoDia(reg: RegistroInput): number {
  if (reg.tipoDia === "FOLGA" || reg.tipoDia === "FALTA") return 0;
  const e = paraMinutos(reg.entrada);
  const s = paraMinutos(reg.saida);
  if (e == null || s == null) return 0;
  const liquidoMin = s - e - (reg.intervaloMin ?? 0);
  if (liquidoMin <= 0) return 0;
  return round2(liquidoMin / 60);
}

/** Apura horas normais e extras de um dia conforme o tipoDia. */
export function apurarDia(reg: RegistroInput, jornadaDiaria: number): ApuracaoDia {
  const horas = horasDoDia(reg);
  const zero: ApuracaoDia = { horas: 0, normais: 0, extra50: 0, extra100: 0 };
  if (horas <= 0) return zero;

  if (reg.tipoDia === "DOMINGO" || reg.tipoDia === "FERIADO") {
    // Domingo/feriado trabalhado: tudo a 100%.
    return { horas, normais: 0, extra50: 0, extra100: horas };
  }
  // UTIL (default): até a jornada é normal, o excedente é extra 50%.
  const normais = round2(Math.min(horas, jornadaDiaria));
  const extra50 = round2(Math.max(0, horas - jornadaDiaria));
  return { horas, normais, extra50, extra100: 0 };
}

/**
 * Apura o mês de um funcionário: soma dia a dia, calcula valorHora e o
 * valor de hora extra, e devolve a linha da folha. Guard div-por-zero em
 * cargaMensalHoras (valorHora = 0 se carga ≤ 0).
 */
export function apurarFuncionario(
  func: FuncionarioInput,
  registros: RegistroInput[]
): FolhaLinhaDTO {
  const salario = new D(func.salarioMensal);
  const valorHora = func.cargaMensalHoras > 0 ? salario.div(func.cargaMensalHoras) : new D(0);

  let totalHoras = new D(0);
  let horasNormais = new D(0);
  let extra50 = new D(0);
  let extra100 = new D(0);
  let diasTrabalhados = 0;

  for (const reg of registros) {
    const dia = apurarDia(reg, func.jornadaDiariaHoras);
    if (dia.horas > 0) diasTrabalhados++;
    totalHoras = totalHoras.add(dia.horas);
    horasNormais = horasNormais.add(dia.normais);
    extra50 = extra50.add(dia.extra50);
    extra100 = extra100.add(dia.extra100);
  }

  // valorExtra = extra50 × valorHora × 1,5 + extra100 × valorHora × 2.
  const valorExtra = extra50
    .mul(valorHora)
    .mul(1.5)
    .add(extra100.mul(valorHora).mul(2));
  const totalPagar = salario.add(valorExtra);

  return {
    funcionarioId: func.id,
    nome: func.nome,
    cargo: func.cargo,
    salarioMensal: round2(salario),
    valorHora: round2(valorHora),
    diasTrabalhados,
    totalHoras: round2(totalHoras),
    horasNormais: round2(horasNormais),
    extra50: round2(extra50),
    extra100: round2(extra100),
    valorExtra: round2(valorExtra),
    totalPagar: round2(totalPagar),
  };
}
