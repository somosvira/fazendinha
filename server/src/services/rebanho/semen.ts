import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type {
  AjustarDosesInput,
  CriarLoteInput,
  CriarTipoSemenInput,
} from "./semen.schemas.js";

export class SemenError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
    super(message);
  }
}

export interface TipoSemenDTO {
  id: number;
  sigla: string;
  nome: string;
}

export interface EstoqueSemenDTO {
  id: number;
  reprodutorId: number;
  tipoSemenId: number | null;
  tipoSemenNome: string | null;
  lote: string | null;
  localizacao: string | null;
  dosesDisponiveis: number;
}

type EstoqueSemenRow = {
  id: number;
  reprodutorId: number;
  tipoSemenId: number | null;
  tipoSemen: { nome: string } | null;
  lote: string | null;
  localizacao: string | null;
  dosesDisponiveis: number;
};

const TIPO_SEMEN_SELECT = { id: true, sigla: true, nome: true } as const;
const ESTOQUE_INCLUDE = { tipoSemen: { select: { nome: true } } } as const;

function catalogoNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {};
}

function estoqueDTO(row: EstoqueSemenRow): EstoqueSemenDTO {
  return {
    id: row.id,
    reprodutorId: row.reprodutorId,
    tipoSemenId: row.tipoSemenId,
    tipoSemenNome: row.tipoSemen?.nome ?? null,
    lote: row.lote,
    localizacao: row.localizacao,
    dosesDisponiveis: row.dosesDisponiveis,
  };
}

async function validarReprodutorNoEscopo(
  reprodutorId: number,
  propriedadeId: number | null,
): Promise<void> {
  const reprodutor = await prisma.reprodutor.findFirst({
    where: { id: reprodutorId, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!reprodutor) throw new SemenError("NAO_ENCONTRADO", "reprodutor não encontrado");
}

async function validarTipoSemen(tipoSemenId: number | null | undefined): Promise<void> {
  if (tipoSemenId == null) return;
  const tipo = await prisma.tipoSemen.findUnique({
    where: { id: tipoSemenId },
    select: { id: true },
  });
  if (!tipo) throw new SemenError("NAO_ENCONTRADO", "tipo de sêmen não encontrado");
}

export async function listarTiposSemen(): Promise<TipoSemenDTO[]> {
  return prisma.tipoSemen.findMany({ select: TIPO_SEMEN_SELECT, orderBy: { sigla: "asc" } });
}

export async function criarTipoSemen(input: CriarTipoSemenInput): Promise<TipoSemenDTO> {
  try {
    return await prisma.tipoSemen.create({ data: input, select: TIPO_SEMEN_SELECT });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SemenError("CONFLITO", "sigla já cadastrada");
    }
    throw e;
  }
}

export async function listarEstoqueSemen(
  reprodutorId: number,
  propriedadeId: number | null,
): Promise<EstoqueSemenDTO[]> {
  await validarReprodutorNoEscopo(reprodutorId, propriedadeId);
  const rows = await prisma.estoqueSemen.findMany({
    where: { reprodutorId, ...(propriedadeId != null ? { propriedadeId } : {}) },
    include: ESTOQUE_INCLUDE,
    orderBy: [{ dosesDisponiveis: "desc" }, { id: "asc" }],
  });
  return rows.map((row) => estoqueDTO(row));
}

export async function criarLoteSemen(
  reprodutorId: number,
  input: CriarLoteInput,
  propriedadeId: number | null,
): Promise<EstoqueSemenDTO> {
  await validarReprodutorNoEscopo(reprodutorId, propriedadeId);
  await validarTipoSemen(input.tipoSemenId);
  const row = await prisma.estoqueSemen.create({
    data: {
      reprodutorId,
      tipoSemenId: input.tipoSemenId,
      lote: input.lote,
      localizacao: input.localizacao,
      dosesDisponiveis: input.dosesDisponiveis,
      propriedadeId,
    },
    include: ESTOQUE_INCLUDE,
  });
  return estoqueDTO(row);
}

export async function ajustarDoses(
  estoqueSemenId: number,
  input: AjustarDosesInput,
  propriedadeId: number | null,
): Promise<EstoqueSemenDTO> {
  const existente = await prisma.estoqueSemen.findFirst({
    where: { id: estoqueSemenId, ...(propriedadeId != null ? { propriedadeId } : {}) },
    include: ESTOQUE_INCLUDE,
  });
  if (!existente) throw new SemenError("NAO_ENCONTRADO", "estoque de sêmen não encontrado");

  const row = await prisma.estoqueSemen.update({
    where: { id: estoqueSemenId },
    data: { dosesDisponiveis: Math.max(0, existente.dosesDisponiveis + input.delta) },
    include: ESTOQUE_INCLUDE,
  });
  return estoqueDTO(row);
}
