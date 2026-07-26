import { prisma } from "../../db.js";
import { listarAptas, type AvaliacaoAptidao, type NovilhaAptidao } from "./aptidao.calc.js";
import type { RegistrarAptidaoInput } from "./aptidao.schemas.js";
import { getNumero } from "./parametros.js";

export class AptidaoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
  }
}

const iso = (data: Date) => data.toISOString().slice(0, 10);
const dataDb = (data: string) => new Date(`${data}T00:00:00Z`);
const hojeIso = () => new Date().toISOString().slice(0, 10);

function animalNoEscopo(animalId: number, propriedadeId: number | null) {
  return { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) };
}

async function garantirAnimalNoEscopo(animalId: number, propriedadeId: number | null) {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new AptidaoError("NAO_ENCONTRADO", "animal não encontrado");
}

export interface AptidaoDTO {
  id: number;
  animalId: number;
  data: string;
  apta: boolean;
  motivo: string | null;
  origem: "MANUAL" | "AUTOMATICA";
}

type AptidaoRow = Omit<AptidaoDTO, "data"> & { data: Date };

function toDTO(row: AptidaoRow): AptidaoDTO {
  return { ...row, data: iso(row.data) };
}

export async function listarAptidoes(
  animalId: number,
  propriedadeId: number | null = null,
): Promise<AptidaoDTO[]> {
  await garantirAnimalNoEscopo(animalId, propriedadeId);
  const rows = await prisma.aptidaoAnimal.findMany({
    where: { animalId },
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  return rows.map((row) => toDTO(row));
}

export async function registrarAptidao(
  animalId: number,
  input: RegistrarAptidaoInput,
  propriedadeId: number | null,
): Promise<AptidaoDTO> {
  await garantirAnimalNoEscopo(animalId, propriedadeId);
  const data = dataDb(input.data);
  const row = await prisma.aptidaoAnimal.upsert({
    where: {
      animalId_data_origem: { animalId, data, origem: "MANUAL" },
    },
    create: {
      animalId,
      data,
      apta: input.apta,
      motivo: input.motivo ?? null,
      origem: "MANUAL",
      propriedadeId,
    },
    update: {
      apta: input.apta,
      motivo: input.motivo ?? null,
      propriedadeId,
    },
  });
  return toDTO(row);
}

type NovilhaRow = {
  id: number;
  numero: string;
  categoria: string;
  dataNascimento: Date | null;
  pesagens: { peso: unknown }[];
};

function toNovilha(row: NovilhaRow): NovilhaAptidao {
  return {
    animalId: row.id,
    numero: row.numero,
    categoria: row.categoria,
    dataNascimento: row.dataNascimento ? iso(row.dataNascimento) : null,
    ultimoPesoKg: row.pesagens[0]?.peso == null ? null : Number(row.pesagens[0].peso),
  };
}

async function obterCriterio() {
  const [idadeMinMeses, pesoMinKg] = await Promise.all([
    getNumero("APTIDAO_IDADE_MIN_MESES"),
    getNumero("APTIDAO_PESO_MIN_KG"),
  ]);
  return {
    idadeMinMeses: idadeMinMeses ?? 13,
    pesoMinKg: pesoMinKg ?? 320,
  };
}

export async function sugerirAptidaoAutomatica(
  propriedadeId: number | null,
  hoje = hojeIso(),
): Promise<AvaliacaoAptidao[]> {
  const rows = await prisma.animal.findMany({
    where: {
      categoria: "NOVILHA",
      status: "ATIVO",
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: {
      id: true,
      numero: true,
      categoria: true,
      dataNascimento: true,
      pesagens: { orderBy: { data: "desc" }, take: 1, select: { peso: true } },
    },
  });
  return listarAptas(rows.map((row) => toNovilha(row)), await obterCriterio(), hoje);
}

export interface AplicacaoAptidaoAutomaticaDTO {
  data: string;
  candidatas: number;
  aplicadas: number;
  ignoradas: number;
}

export async function aplicarAptidaoAutomatica(
  propriedadeId: number | null,
  hoje = hojeIso(),
): Promise<AplicacaoAptidaoAutomaticaDTO> {
  const candidatas = await sugerirAptidaoAutomatica(propriedadeId, hoje);
  if (candidatas.length === 0) return { data: hoje, candidatas: 0, aplicadas: 0, ignoradas: 0 };

  const data = dataDb(hoje);
  const existentes = await prisma.aptidaoAnimal.findMany({
    where: {
      animalId: { in: candidatas.map((item) => item.animalId) },
      data,
      origem: "AUTOMATICA",
    },
    select: { animalId: true },
  });
  const existentesIds = new Set(existentes.map((item) => item.animalId));
  const novas = candidatas.filter((item) => !existentesIds.has(item.animalId));
  const resultado = novas.length === 0
    ? { count: 0 }
    : await prisma.aptidaoAnimal.createMany({
      data: novas.map((item) => ({
        animalId: item.animalId,
        data,
        apta: true,
        motivo: item.motivo,
        origem: "AUTOMATICA" as const,
        propriedadeId,
      })),
      skipDuplicates: true,
    });

  return {
    data: hoje,
    candidatas: candidatas.length,
    aplicadas: resultado.count,
    ignoradas: candidatas.length - resultado.count,
  };
}
