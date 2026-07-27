import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import {
  projetarColunasLegadas,
  type ColunaLegada,
  type IndicadorEspelho,
} from "./genetica-espelho.calc.js";
import { ranquearPorIndicador, type DirecaoRanking } from "./ranking-reprodutor.calc.js";
import { resumoIndices, type ReprodutorIndices } from "./reprodutor.calc.js";
import type {
  AtualizarIndicadorInput,
  CriarDicionarioInput,
  CriarIndicadorInput,
  SalvarFichaInput,
} from "./genetica.schemas.js";

export class GeneticaError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
    super(message);
  }
}

export interface IndicadorDTO {
  id: number;
  sigla: string;
  nome: string;
  unidade: string | null;
  direcao: "maior_melhor" | "menor_melhor";
  colunaLegada: string | null;
  ranking: boolean;
  ativo: boolean;
}

export interface PedigreeDTO {
  paiNome: string | null;
  paiCodigo: string | null;
  maeNome: string | null;
  maeCodigo: string | null;
  avoMaternoNome: string | null;
  avoMaternoCodigo: string | null;
  avoPaternoNome: string | null;
  avoPaternoCodigo: string | null;
}

export interface FichaGeneticaDTO {
  valoresIndicador: { indicadorId: number; valor: number }[];
  valoresMarcador: { marcadorId: number; resultado: string }[];
  valoresCaseina: { caseinaId: number; genotipo: string }[];
  pedigree: PedigreeDTO | null;
}

type DicionarioDTO = { id: number; sigla: string; nome: string };

type IndicadorRow = {
  id: number;
  sigla: string;
  nome: string;
  unidade: string | null;
  direcao: string;
  colunaLegada: string | null;
  ranking: boolean;
  ativo: boolean;
};

const FICHA_INCLUDE = {
  valoresIndicador: { select: { indicadorId: true, valor: true } },
  valoresMarcador: { select: { marcadorId: true, resultado: true } },
  valoresCaseina: { select: { caseinaId: true, genotipo: true } },
  pedigree: {
    select: {
      paiNome: true,
      paiCodigo: true,
      maeNome: true,
      maeCodigo: true,
      avoMaternoNome: true,
      avoMaternoCodigo: true,
      avoPaternoNome: true,
      avoPaternoCodigo: true,
    },
  },
} as const;

// Registros sem propriedade são catálogos compartilhados legados.
function catalogoNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {};
}

function indicadorDTO(row: IndicadorRow): IndicadorDTO {
  return {
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    unidade: row.unidade,
    direcao: row.direcao as IndicadorDTO["direcao"],
    colunaLegada: row.colunaLegada,
    ranking: row.ranking,
    ativo: row.ativo,
  };
}

function fichaDTO(row: {
  valoresIndicador: { indicadorId: number; valor: unknown }[];
  valoresMarcador: { marcadorId: number; resultado: string }[];
  valoresCaseina: { caseinaId: number; genotipo: string }[];
  pedigree: PedigreeDTO | null;
}): FichaGeneticaDTO {
  return {
    valoresIndicador: row.valoresIndicador.map((v) => ({ indicadorId: v.indicadorId, valor: Number(v.valor) })),
    valoresMarcador: row.valoresMarcador,
    valoresCaseina: row.valoresCaseina,
    pedigree: row.pedigree,
  };
}

function codigoPrisma(e: unknown): string | null {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null;
}

function conflitoSigla(e: unknown): never {
  if (codigoPrisma(e) === "P2002") throw new GeneticaError("CONFLITO", "sigla já cadastrada");
  throw e;
}

function naoEncontrado(e: unknown, entidade: string): never {
  if (codigoPrisma(e) === "P2025") throw new GeneticaError("NAO_ENCONTRADO", `${entidade} não encontrado`);
  conflitoSigla(e);
}

export async function listarIndicadores(): Promise<IndicadorDTO[]> {
  const rows = await prisma.indicadorGenetico.findMany({ orderBy: [{ ranking: "desc" }, { sigla: "asc" }] });
  return rows.map((row) => indicadorDTO(row));
}

export async function criarIndicador(input: CriarIndicadorInput): Promise<IndicadorDTO> {
  try {
    const row = await prisma.indicadorGenetico.create({
      data: {
        sigla: input.sigla,
        nome: input.nome,
        unidade: input.unidade,
        direcao: input.direcao ?? "maior_melhor",
        colunaLegada: input.colunaLegada,
        ranking: input.ranking ?? false,
        ativo: input.ativo ?? true,
      },
    });
    return indicadorDTO(row);
  } catch (e) {
    conflitoSigla(e);
  }
}

export async function atualizarIndicador(id: number, input: AtualizarIndicadorInput): Promise<IndicadorDTO> {
  try {
    const row = await prisma.indicadorGenetico.update({ where: { id }, data: input });
    return indicadorDTO(row);
  } catch (e) {
    naoEncontrado(e, "indicador");
  }
}

export async function excluirIndicador(id: number): Promise<void> {
  const existente = await prisma.indicadorGenetico.findUnique({ where: { id }, select: { id: true } });
  if (!existente) throw new GeneticaError("NAO_ENCONTRADO", "indicador não encontrado");

  const emUso = await prisma.valorIndicadorReprodutor.count({ where: { indicadorId: id } });
  if (emUso > 0) {
    await prisma.indicadorGenetico.update({ where: { id }, data: { ativo: false } });
    return;
  }
  await prisma.indicadorGenetico.delete({ where: { id } });
}

export async function listarMarcadores(): Promise<DicionarioDTO[]> {
  return prisma.marcadorGenetico.findMany({ select: { id: true, sigla: true, nome: true }, orderBy: { sigla: "asc" } });
}

export async function criarMarcador(input: CriarDicionarioInput): Promise<DicionarioDTO> {
  try {
    return await prisma.marcadorGenetico.create({ data: input, select: { id: true, sigla: true, nome: true } });
  } catch (e) {
    conflitoSigla(e);
  }
}

export async function listarCaseinas(): Promise<DicionarioDTO[]> {
  return prisma.caseina.findMany({ select: { id: true, sigla: true, nome: true }, orderBy: { sigla: "asc" } });
}

export async function criarCaseina(input: CriarDicionarioInput): Promise<DicionarioDTO> {
  try {
    return await prisma.caseina.create({ data: input, select: { id: true, sigla: true, nome: true } });
  } catch (e) {
    conflitoSigla(e);
  }
}

export async function obterFichaGenetica(
  reprodutorId: number,
  propriedadeId: number | null,
): Promise<FichaGeneticaDTO> {
  const row = await prisma.reprodutor.findFirst({
    where: { id: reprodutorId, ...catalogoNoEscopo(propriedadeId) },
    include: FICHA_INCLUDE,
  });
  if (!row) throw new GeneticaError("NAO_ENCONTRADO", "reprodutor não encontrado");
  return fichaDTO(row);
}

export async function salvarFichaGenetica(
  reprodutorId: number,
  input: SalvarFichaInput,
  propriedadeId: number | null,
): Promise<FichaGeneticaDTO> {
  const existente = await prisma.reprodutor.findFirst({
    where: { id: reprodutorId, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new GeneticaError("NAO_ENCONTRADO", "reprodutor não encontrado");

  await prisma.$transaction(async (tx) => {
    await tx.valorIndicadorReprodutor.deleteMany({ where: { reprodutorId } });
    if (input.valoresIndicador.length > 0) {
      await tx.valorIndicadorReprodutor.createMany({
        data: input.valoresIndicador.map((v) => ({ reprodutorId, ...v })),
      });
    }

    await tx.valorMarcadorReprodutor.deleteMany({ where: { reprodutorId } });
    if (input.valoresMarcador.length > 0) {
      await tx.valorMarcadorReprodutor.createMany({
        data: input.valoresMarcador.map((v) => ({ reprodutorId, ...v })),
      });
    }

    await tx.valorCaseinaReprodutor.deleteMany({ where: { reprodutorId } });
    if (input.valoresCaseina.length > 0) {
      await tx.valorCaseinaReprodutor.createMany({
        data: input.valoresCaseina.map((v) => ({ reprodutorId, ...v })),
      });
    }

    const indicadores = await tx.indicadorGenetico.findMany({
      select: { id: true, colunaLegada: true },
    });
    const indicadoresPorId = new Map(
      indicadores.map((indicador) => [indicador.id, indicador as IndicadorEspelho]),
    );
    const colunasGerenciadas = Object.fromEntries(
      indicadores
        .map((indicador) => indicador.colunaLegada)
        .filter((coluna): coluna is ColunaLegada => coluna != null)
        .map((coluna) => [coluna, null]),
    ) as Partial<Record<ColunaLegada, null>>;
    const colunasLegadas = {
      ...colunasGerenciadas,
      ...projetarColunasLegadas(input.valoresIndicador, indicadoresPorId),
    };
    if (Object.keys(colunasLegadas).length > 0) {
      await tx.reprodutor.update({ where: { id: reprodutorId }, data: colunasLegadas });
    }

    if (input.pedigree != null) {
      await tx.pedigreeReprodutor.upsert({
        where: { reprodutorId },
        create: { reprodutorId, ...input.pedigree },
        update: input.pedigree,
      });
    }
  });

  return obterFichaGenetica(reprodutorId, propriedadeId);
}

function compararDescNulosUltimo(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

export async function rankingReprodutores(
  indicadorId: number | null,
  propriedadeId: number | null,
): Promise<{ ordem: number[]; indicadorId: number | null }> {
  const indicador = indicadorId == null
    ? null
    : await prisma.indicadorGenetico.findUnique({ where: { id: indicadorId }, select: { id: true, direcao: true } });
  if (indicadorId != null && !indicador) {
    throw new GeneticaError("NAO_ENCONTRADO", "indicador não encontrado");
  }

  const rows = await prisma.reprodutor.findMany({
    where: { ativo: true, ...catalogoNoEscopo(propriedadeId) },
    select: {
      id: true,
      ptaLeite: true,
      ptaGordura: true,
      ptaProteina: true,
      tpi: true,
      valoresIndicador: indicadorId == null
        ? false
        : { where: { indicadorId }, select: { indicadorId: true, valor: true } },
    },
  });

  if (indicadorId != null && indicador) {
    const ordenados = ranquearPorIndicador(
      rows.map((row) => ({
        id: row.id,
        valorIndicador: row.valoresIndicador[0] == null ? null : Number(row.valoresIndicador[0].valor),
      })),
      indicador.direcao as DirecaoRanking,
    );
    return { ordem: ordenados.map((row) => row.id), indicadorId };
  }

  const indices: ReprodutorIndices[] = rows.map((row) => ({
    id: row.id,
    ptaLeite: row.ptaLeite == null ? null : Number(row.ptaLeite),
    ptaGordura: row.ptaGordura == null ? null : Number(row.ptaGordura),
    ptaProteina: row.ptaProteina == null ? null : Number(row.ptaProteina),
    tpi: row.tpi,
  }));
  const resumo = resumoIndices(indices);
  if (resumo.total === 0) return { ordem: [], indicadorId: null };

  const ordem = [...indices]
    .sort((a, b) => compararDescNulosUltimo(a.ptaLeite, b.ptaLeite)
      || compararDescNulosUltimo(a.tpi, b.tpi)
      || a.id - b.id)
    .map((row) => row.id);
  return { ordem, indicadorId: null };
}
