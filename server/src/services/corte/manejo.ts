/* Serviço de manejo do Corte (Onda 2) — manejo sanitário + suplementação.
 *
 * Persistência via Prisma. Ao criar um manejo sanitário dispara
 * recomputarResumo(loteId) para que proximaVacina/proximoVermifugo/ultimoManejo
 * do read-model ResumoLote sejam recalculados pelo engine.
 */
import { prisma } from "../../db.js";
import { recomputarResumo } from "./resumos.recompute.js";
import { toDate } from "./schemas.corte-eventos.js";
import type { CriarManejoInput, CriarSuplementacaoInput } from "./schemas.corte-eventos.js";

export class CorteEventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "REF_INVALIDA", message: string) {
    super(message);
  }
}

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const num = (x: any) => (x != null ? Number(x) : undefined);

async function assertLote(loteId: number) {
  if (!(await prisma.loteCorte.findUnique({ where: { id: loteId }, select: { id: true } })))
    throw new CorteEventoError("NAO_ENCONTRADO", "lote não encontrado");
}

// ── Manejo sanitário ─────────────────────────────────────────────────────────

export interface ManejoSanitarioDTO {
  id: string;
  loteId: string;
  data: string;
  tipo: string;
  produto?: string;
  doseMl?: number;
  numCabecas: number;
  responsavel?: string;
  carenciaDias?: number;
  proximaDose?: string;
  observacao?: string;
}

function toManejoDTO(m: any): ManejoSanitarioDTO {
  return {
    id: String(m.id),
    loteId: String(m.loteId),
    data: iso(m.data),
    tipo: m.tipo,
    produto: m.produto ?? undefined,
    doseMl: num(m.doseMl),
    numCabecas: m.numCabecas,
    responsavel: m.responsavel ?? undefined,
    carenciaDias: m.carenciaDias ?? undefined,
    proximaDose: m.proximaDose ? iso(m.proximaDose) : undefined,
    observacao: m.observacao ?? undefined,
  };
}

export async function listarManejos(loteId: number): Promise<ManejoSanitarioDTO[]> {
  const rows = await prisma.manejoSanitario.findMany({ where: { loteId }, orderBy: { data: "desc" } });
  return rows.map(toManejoDTO);
}

export async function criarManejoSanitario(
  loteId: number,
  input: CriarManejoInput
): Promise<ManejoSanitarioDTO> {
  await assertLote(loteId);
  const row = await prisma.manejoSanitario.create({
    data: {
      loteId,
      data: new Date(input.data),
      tipo: input.tipo,
      produto: input.produto ?? null,
      doseMl: input.doseMl ?? null,
      numCabecas: input.numCabecas,
      responsavel: input.responsavel ?? null,
      carenciaDias: input.carenciaDias ?? null,
      proximaDose: toDate(input.proximaDose) ?? null,
      observacao: input.observacao ?? null,
    },
  });
  // Recalcula proximaVacina/proximoVermifugo/ultimoManejo do read-model.
  await recomputarResumo(loteId);
  return toManejoDTO(row);
}

// ── Suplementação ────────────────────────────────────────────────────────────

export interface SuplementacaoDTO {
  id: string;
  loteId: string;
  dataInicio: string;
  dataFim?: string;
  tipo: string;
  produto: string;
  consumoCabecaDiaG: number;
  custoKg?: number;
  observacao?: string;
}

function toSuplementacaoDTO(s: any): SuplementacaoDTO {
  return {
    id: String(s.id),
    loteId: String(s.loteId),
    dataInicio: iso(s.dataInicio),
    dataFim: s.dataFim ? iso(s.dataFim) : undefined,
    tipo: s.tipo,
    produto: s.produto,
    consumoCabecaDiaG: Number(s.consumoCabecaDiaG),
    custoKg: num(s.custoKg),
    observacao: s.observacao ?? undefined,
  };
}

export async function listarSuplementacoes(loteId: number): Promise<SuplementacaoDTO[]> {
  const rows = await prisma.suplementacao.findMany({ where: { loteId }, orderBy: { dataInicio: "desc" } });
  return rows.map(toSuplementacaoDTO);
}

export async function criarSuplementacao(
  loteId: number,
  input: CriarSuplementacaoInput
): Promise<SuplementacaoDTO> {
  await assertLote(loteId);
  const row = await prisma.suplementacao.create({
    data: {
      loteId,
      dataInicio: new Date(input.dataInicio),
      dataFim: toDate(input.dataFim) ?? null,
      tipo: input.tipo,
      produto: input.produto,
      consumoCabecaDiaG: input.consumoCabecaDiaG,
      custoKg: input.custoKg ?? null,
      observacao: input.observacao ?? null,
    },
  });
  return toSuplementacaoDTO(row);
}
