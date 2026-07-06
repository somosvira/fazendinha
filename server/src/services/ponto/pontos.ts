import { Prisma, type TipoDiaPonto } from "@prisma/client";
import { prisma } from "../../db.js";
import { apurarDia, type RegistroInput } from "./folha.js";
import { FuncionarioError } from "./funcionarios.js";

export interface RegistroDTO {
  id: string;
  funcionarioId: string;
  data: string; // YYYY-MM-DD
  entrada: string | null;
  saida: string | null;
  intervaloMin: number;
  tipoDia: string;
  observacao: string | null;
  horas: number;
  extra50: number;
  extra100: number;
}

const iso = (d: Date): string => new Date(d).toISOString().slice(0, 10);

/** "YYYY-MM" → [primeiro dia do mês, primeiro dia do mês seguinte). Datas UTC. */
function janelaMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, m - 1, 1));
  const fim = new Date(Date.UTC(ano, m, 1)); // exclusivo
  return { inicio, fim };
}

// ── Pré-preenchimento da grade (horário padrão) ─────────────────────────────

/** Subconjunto do Funcionario com o horário padrão (o que a grade padrão usa). */
export interface HorarioPadraoFuncionario {
  horaEntradaPadrao: string | null;
  horaSaidaPadrao: string | null;
  intervaloPadraoMin: number | null;
}

/** Registro que a grade padrão pretende criar num dia útil ainda vazio. */
export interface RegistroPadraoGerado {
  data: string; // YYYY-MM-DD
  entrada: string; // "HH:MM"
  saida: string; // "HH:MM"
  intervaloMin: number;
  tipoDia: "UTIL";
}

const INTERVALO_PADRAO_FALLBACK = 60;

/**
 * Classificação default do dia pelo dia-da-semana, usada no pré-preenchimento.
 * Espelha o `tipoDiaPadrao` do client (domingo → DOMINGO) e estende o sábado
 * como FOLGA, para que o fim de semana INTEIRO fique fora da grade padrão
 * (07:00–17:00 é jornada de dia útil; sábado/domingo o admin lança à mão).
 * Só o retorno "UTIL" gera registro — os demais são apenas sinal de "pular".
 */
export function tipoDiaPorDataPadrao(dataISO: string): TipoDiaPonto {
  const [y, m, dd] = dataISO.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); // 0=dom … 6=sáb
  if (dow === 0) return "DOMINGO";
  if (dow === 6) return "FOLGA";
  return "UTIL";
}

/**
 * PURA (sem DB). Gera os RegistroPonto que faltam num mês aplicando o horário
 * padrão do funcionário SÓ nos dias úteis (onde `tipoDiaPorData` devolve "UTIL").
 * Idempotente: pula os dias em `datasExistentes` (não sobrescreve). Funcionário
 * sem padrão (entrada ou saída null) → devolve `[]` (grade vazia). `mes` é 1-12.
 */
export function montarGradePadrao(
  funcionario: HorarioPadraoFuncionario,
  ano: number,
  mes: number,
  tipoDiaPorData: (dataISO: string) => TipoDiaPonto,
  datasExistentes: Iterable<string> = []
): RegistroPadraoGerado[] {
  const { horaEntradaPadrao, horaSaidaPadrao } = funcionario;
  if (!horaEntradaPadrao || !horaSaidaPadrao) return []; // sem padrão → nada
  const intervaloMin = funcionario.intervaloPadraoMin ?? INTERVALO_PADRAO_FALLBACK;
  const existentes = new Set(datasExistentes);
  const totalDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // último dia do mês
  const out: RegistroPadraoGerado[] = [];
  for (let dia = 1; dia <= totalDias; dia++) {
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (existentes.has(data)) continue; // já existe → não duplica
    if (tipoDiaPorData(data) !== "UTIL") continue; // fim de semana/feriado → pula
    out.push({ data, entrada: horaEntradaPadrao, saida: horaSaidaPadrao, intervaloMin, tipoDia: "UTIL" });
  }
  return out;
}

/** Registro Prisma → DTO com horas/extra computados pelo motor puro. */
function toRegistroDTO(r: any, jornadaDiaria: number): RegistroDTO {
  const input: RegistroInput = {
    entrada: r.entrada,
    saida: r.saida,
    intervaloMin: r.intervaloMin,
    tipoDia: r.tipoDia,
  };
  const dia = apurarDia(input, jornadaDiaria);
  return {
    id: String(r.id),
    funcionarioId: String(r.funcionarioId),
    data: iso(r.data),
    entrada: r.entrada ?? null,
    saida: r.saida ?? null,
    intervaloMin: r.intervaloMin,
    tipoDia: r.tipoDia,
    observacao: r.observacao ?? null,
    horas: dia.horas,
    extra50: dia.extra50,
    extra100: dia.extra100,
  };
}

async function assertFuncionario(id: number) {
  const f = await prisma.funcionario.findUnique({ where: { id } });
  if (!f) throw new FuncionarioError("NAO_ENCONTRADO", "funcionário não encontrado");
  return f;
}

/** Lista os registros de um funcionário num mês, com horas/extra por dia. */
export async function listarRegistros(funcionarioId: number, mes: string): Promise<RegistroDTO[]> {
  const func = await assertFuncionario(funcionarioId);
  const { inicio, fim } = janelaMes(mes);
  const rows = await prisma.registroPonto.findMany({
    where: { funcionarioId, data: { gte: inicio, lt: fim } },
    orderBy: { data: "asc" },
  });
  const jornada = Number(func.jornadaDiariaHoras);
  return rows.map((r) => toRegistroDTO(r, jornada));
}

export interface UpsertRegistroInput {
  funcionarioId: number;
  data: string; // YYYY-MM-DD
  entrada?: string | null;
  saida?: string | null;
  intervaloMin: number;
  tipoDia: string;
  observacao?: string | null;
}

/** Upsert por (funcionarioId, data): cria ou atualiza o registro do dia. */
export async function upsertRegistro(input: UpsertRegistroInput): Promise<RegistroDTO> {
  const func = await assertFuncionario(input.funcionarioId);
  const data = new Date(input.data);
  // Zod validou input.tipoDia contra os 5 valores do enum — cast tipado é seguro.
  const payload = {
    entrada: input.entrada ?? null,
    saida: input.saida ?? null,
    intervaloMin: input.intervaloMin,
    tipoDia: input.tipoDia as TipoDiaPonto,
    observacao: input.observacao ?? null,
  };
  const row = await prisma.registroPonto.upsert({
    where: { funcionarioId_data: { funcionarioId: input.funcionarioId, data } },
    update: payload,
    create: { funcionarioId: input.funcionarioId, data, ...payload },
  });
  return toRegistroDTO(row, Number(func.jornadaDiariaHoras));
}

export interface PreencherGradeResult {
  criados: number;
  registros: RegistroDTO[];
}

/**
 * Aplica o horário padrão do funcionário na grade de um mês (ano, mes 1-12).
 * Idempotente: só cria os dias úteis que ainda não têm registro. Funcionário
 * sem padrão → não cria nada (criados: 0). Devolve a grade do mês recalculada.
 */
export async function preencherGradePadrao(
  funcionarioId: number,
  ano: number,
  mes: number
): Promise<PreencherGradeResult> {
  const func = await assertFuncionario(funcionarioId);
  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
  const { inicio, fim } = janelaMes(mesStr);

  const existentes = await prisma.registroPonto.findMany({
    where: { funcionarioId, data: { gte: inicio, lt: fim } },
    select: { data: true },
  });
  const datasExistentes = existentes.map((r) => iso(r.data));

  const novos = montarGradePadrao(func, ano, mes, tipoDiaPorDataPadrao, datasExistentes);
  if (novos.length > 0) {
    // skipDuplicates: cinto-e-suspensório contra corrida — a unique
    // (funcionarioId, data) já garante que não haja duplicata.
    await prisma.registroPonto.createMany({
      data: novos.map((n) => ({
        funcionarioId,
        data: new Date(n.data),
        entrada: n.entrada,
        saida: n.saida,
        intervaloMin: n.intervaloMin,
        tipoDia: n.tipoDia,
      })),
      skipDuplicates: true,
    });
  }

  const registros = await listarRegistros(funcionarioId, mesStr);
  return { criados: novos.length, registros };
}

export async function excluirRegistro(id: number): Promise<void> {
  // Atomic: Prisma dispara P2025 se o registro não existir — evita round-trip extra.
  try {
    await prisma.registroPonto.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new FuncionarioError("NAO_ENCONTRADO", "registro não encontrado");
    }
    throw e;
  }
}
