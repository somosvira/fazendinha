import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import {
  criarCombinacaoMedidaSchema,
  criarMedidaAcasalamentoSchema,
  type AtualizarCombinacaoMedidaInput,
  type AtualizarMedidaAcasalamentoInput,
  type CriarCombinacaoMedidaInput,
  type CriarMedidaAcasalamentoInput,
  type TipoMedidaAcasalamento,
} from "./medidas-acasalamento.schemas.js";

export class MedidaAcasalamentoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
    super(message);
  }
}

export interface ItemMedidaAcasalamentoDTO {
  indicadorId: number;
  indicadorSigla: string;
  peso: number;
  minimo: number | null;
  maximo: number | null;
}

export interface MedidaAcasalamentoDTO {
  id: number;
  nome: string;
  tipo: TipoMedidaAcasalamento;
  consanguinidadeMax: number | null;
  exigePedigree: boolean;
  ativo: boolean;
  itens: ItemMedidaAcasalamentoDTO[];
}

export interface ItemCombinacaoMedidaDTO {
  medidaId: number;
  medidaNome: string;
  medidaTipo: TipoMedidaAcasalamento;
  peso: number;
  obrigatoria: boolean;
  ordem: number;
}

export interface CombinacaoMedidaDTO {
  id: number;
  nome: string;
  ativo: boolean;
  itens: ItemCombinacaoMedidaDTO[];
}

const MEDIDA_INCLUDE = {
  itens: {
    include: { indicador: { select: { sigla: true } } },
    orderBy: { id: "asc" },
  },
} as const satisfies Prisma.MedidaAcasalamentoInclude;

const COMBINACAO_INCLUDE = {
  itens: {
    include: { medida: { select: { nome: true, tipo: true } } },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
  },
} as const satisfies Prisma.CombinacaoMedidaAcasalamentoInclude;

type MedidaRow = Prisma.MedidaAcasalamentoGetPayload<{ include: typeof MEDIDA_INCLUDE }>;
type CombinacaoRow = Prisma.CombinacaoMedidaAcasalamentoGetPayload<{ include: typeof COMBINACAO_INCLUDE }>;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function medidaDTO(row: MedidaRow): MedidaAcasalamentoDTO {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo as TipoMedidaAcasalamento,
    consanguinidadeMax: row.consanguinidadeMax == null ? null : Number(row.consanguinidadeMax),
    exigePedigree: row.exigePedigree,
    ativo: row.ativo,
    itens: row.itens.map((item) => ({
      indicadorId: item.indicadorId,
      indicadorSigla: item.indicador.sigla,
      peso: Number(item.peso),
      minimo: item.minimo == null ? null : Number(item.minimo),
      maximo: item.maximo == null ? null : Number(item.maximo),
    })),
  };
}

function combinacaoDTO(row: CombinacaoRow): CombinacaoMedidaDTO {
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    itens: row.itens.map((item) => ({
      medidaId: item.medidaId,
      medidaNome: item.medida.nome,
      medidaTipo: item.medida.tipo as TipoMedidaAcasalamento,
      peso: Number(item.peso),
      obrigatoria: item.obrigatoria,
      ordem: item.ordem,
    })),
  };
}

function codigoPrisma(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

function mapearErro(error: unknown, entidade: "medida" | "combinação"): never {
  if (codigoPrisma(error) === "P2002") {
    throw new MedidaAcasalamentoError("CONFLITO", "nome já cadastrado");
  }
  if (codigoPrisma(error) === "P2025") {
    throw new MedidaAcasalamentoError("NAO_ENCONTRADO", `${entidade} não encontrada`);
  }
  throw error;
}

async function obterMedida(id: number): Promise<MedidaAcasalamentoDTO> {
  const row = await prisma.medidaAcasalamento.findUnique({ where: { id }, include: MEDIDA_INCLUDE });
  if (!row) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");
  return medidaDTO(row);
}

async function obterCombinacao(id: number): Promise<CombinacaoMedidaDTO> {
  const row = await prisma.combinacaoMedidaAcasalamento.findUnique({
    where: { id },
    include: COMBINACAO_INCLUDE,
  });
  if (!row) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
  return combinacaoDTO(row);
}

async function validarIndicadoresAtivos(tx: Tx, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const encontrados = await tx.indicadorGenetico.findMany({
    where: { id: { in: ids }, ativo: true },
    select: { id: true },
  });
  if (encontrados.length !== ids.length) {
    throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "indicador não encontrado");
  }
}

async function substituirItensMedida(
  tx: Tx,
  medidaId: number,
  itens: CriarMedidaAcasalamentoInput["itens"],
): Promise<void> {
  await tx.itemMedidaAcasalamento.deleteMany({ where: { medidaId } });
  if (itens.length > 0) {
    await tx.itemMedidaAcasalamento.createMany({
      data: itens.map((item) => ({ medidaId, ...item })),
    });
  }
}

async function validarMedidasAtivas(tx: Tx, ids: number[]): Promise<void> {
  const encontradas = await tx.medidaAcasalamento.findMany({
    where: { id: { in: ids }, ativo: true },
    select: { id: true },
  });
  if (encontradas.length !== ids.length) {
    throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");
  }
}

async function substituirItensCombinacao(
  tx: Tx,
  combinacaoId: number,
  itens: CriarCombinacaoMedidaInput["itens"],
): Promise<void> {
  await tx.itemCombinacaoMedida.deleteMany({ where: { combinacaoId } });
  await tx.itemCombinacaoMedida.createMany({
    data: itens.map((item) => ({ combinacaoId, ...item })),
  });
}

export async function listarMedidasAcasalamento(
  incluirInativas = false,
): Promise<MedidaAcasalamentoDTO[]> {
  const rows = await prisma.medidaAcasalamento.findMany({
    where: incluirInativas ? {} : { ativo: true },
    include: MEDIDA_INCLUDE,
    orderBy: { nome: "asc" },
  });
  return rows.map(medidaDTO);
}

export async function criarMedidaAcasalamento(
  input: CriarMedidaAcasalamentoInput,
): Promise<MedidaAcasalamentoDTO> {
  try {
    const id = await prisma.$transaction(async (tx) => {
      await validarIndicadoresAtivos(tx, input.itens.map((item) => item.indicadorId));
      const medida = await tx.medidaAcasalamento.create({
        data: {
          nome: input.nome,
          tipo: input.tipo,
          consanguinidadeMax: input.consanguinidadeMax,
          exigePedigree: input.exigePedigree,
          ativo: input.ativo,
        },
        select: { id: true },
      });
      await substituirItensMedida(tx, medida.id, input.itens);
      return medida.id;
    });
    return obterMedida(id);
  } catch (error) {
    mapearErro(error, "medida");
  }
}

export async function atualizarMedidaAcasalamento(
  id: number,
  input: AtualizarMedidaAcasalamentoInput,
): Promise<MedidaAcasalamentoDTO> {
  const existente = await prisma.medidaAcasalamento.findUnique({ where: { id }, include: MEDIDA_INCLUDE });
  if (!existente) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");

  const estadoFinal = criarMedidaAcasalamentoSchema.parse({
    nome: input.nome ?? existente.nome,
    tipo: input.tipo ?? existente.tipo,
    consanguinidadeMax: input.consanguinidadeMax !== undefined
      ? input.consanguinidadeMax
      : existente.consanguinidadeMax == null ? null : Number(existente.consanguinidadeMax),
    exigePedigree: input.exigePedigree ?? existente.exigePedigree,
    ativo: input.ativo ?? existente.ativo,
    itens: input.itens ?? existente.itens.map((item) => ({
      indicadorId: item.indicadorId,
      peso: Number(item.peso),
      minimo: item.minimo == null ? null : Number(item.minimo),
      maximo: item.maximo == null ? null : Number(item.maximo),
    })),
  });

  try {
    await prisma.$transaction(async (tx) => {
      await validarIndicadoresAtivos(tx, estadoFinal.itens.map((item) => item.indicadorId));
      await tx.medidaAcasalamento.update({
        where: { id },
        data: {
          nome: estadoFinal.nome,
          tipo: estadoFinal.tipo,
          consanguinidadeMax: estadoFinal.consanguinidadeMax,
          exigePedigree: estadoFinal.exigePedigree,
          ativo: estadoFinal.ativo,
        },
      });
      await substituirItensMedida(tx, id, estadoFinal.itens);
    });
    return obterMedida(id);
  } catch (error) {
    mapearErro(error, "medida");
  }
}

export async function excluirMedidaAcasalamento(id: number): Promise<void> {
  const existente = await prisma.medidaAcasalamento.findUnique({ where: { id }, select: { id: true } });
  if (!existente) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "medida não encontrada");

  try {
    const emUso = await prisma.itemCombinacaoMedida.count({ where: { medidaId: id } });
    if (emUso > 0) {
      await prisma.medidaAcasalamento.update({ where: { id }, data: { ativo: false } });
      return;
    }
    await prisma.medidaAcasalamento.delete({ where: { id } });
  } catch (error) {
    mapearErro(error, "medida");
  }
}

export async function listarCombinacoesMedida(
  incluirInativas = false,
): Promise<CombinacaoMedidaDTO[]> {
  const rows = await prisma.combinacaoMedidaAcasalamento.findMany({
    where: incluirInativas ? {} : { ativo: true },
    include: COMBINACAO_INCLUDE,
    orderBy: { nome: "asc" },
  });
  return rows.map(combinacaoDTO);
}

export async function criarCombinacaoMedida(
  input: CriarCombinacaoMedidaInput,
): Promise<CombinacaoMedidaDTO> {
  try {
    const id = await prisma.$transaction(async (tx) => {
      await validarMedidasAtivas(tx, input.itens.map((item) => item.medidaId));
      const combinacao = await tx.combinacaoMedidaAcasalamento.create({
        data: { nome: input.nome, ativo: input.ativo },
        select: { id: true },
      });
      await substituirItensCombinacao(tx, combinacao.id, input.itens);
      return combinacao.id;
    });
    return obterCombinacao(id);
  } catch (error) {
    mapearErro(error, "combinação");
  }
}

export async function atualizarCombinacaoMedida(
  id: number,
  input: AtualizarCombinacaoMedidaInput,
): Promise<CombinacaoMedidaDTO> {
  const existente = await prisma.combinacaoMedidaAcasalamento.findUnique({
    where: { id },
    include: COMBINACAO_INCLUDE,
  });
  if (!existente) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");

  const estadoFinal = criarCombinacaoMedidaSchema.parse({
    nome: input.nome ?? existente.nome,
    ativo: input.ativo ?? existente.ativo,
    itens: input.itens ?? existente.itens.map((item) => ({
      medidaId: item.medidaId,
      peso: Number(item.peso),
      obrigatoria: item.obrigatoria,
      ordem: item.ordem,
    })),
  });

  try {
    await prisma.$transaction(async (tx) => {
      await validarMedidasAtivas(tx, estadoFinal.itens.map((item) => item.medidaId));
      await tx.combinacaoMedidaAcasalamento.update({
        where: { id },
        data: { nome: estadoFinal.nome, ativo: estadoFinal.ativo },
      });
      await substituirItensCombinacao(tx, id, estadoFinal.itens);
    });
    return obterCombinacao(id);
  } catch (error) {
    mapearErro(error, "combinação");
  }
}

export async function excluirCombinacaoMedida(id: number): Promise<void> {
  const existente = await prisma.combinacaoMedidaAcasalamento.findUnique({ where: { id }, select: { id: true } });
  if (!existente) throw new MedidaAcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");

  try {
    const emUso = await prisma.planoAcasalamento.count({ where: { combinacaoId: id } });
    if (emUso > 0) {
      await prisma.combinacaoMedidaAcasalamento.update({ where: { id }, data: { ativo: false } });
      return;
    }
    await prisma.combinacaoMedidaAcasalamento.delete({ where: { id } });
  } catch (error) {
    mapearErro(error, "combinação");
  }
}
