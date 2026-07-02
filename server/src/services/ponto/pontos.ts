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
