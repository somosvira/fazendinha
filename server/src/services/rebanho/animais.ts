import { prisma } from "../../db.js";
import { toAnimalDTO } from "./animais.mappers.js";
import { propriedadePrincipalId } from "../propriedade.js";
import type { AnimalDTO, GrupoDTO, RacaDTO } from "./types.js";
import type { CriarAnimalInput, EditarAnimalInput, BaixaInput, ListFiltros } from "./animais.schemas.js";

export class AnimalError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "NUMERO_DUPLICADO" | "REF_INVALIDA", message: string) {
    super(message);
  }
}

const include = {
  raca: true, grupo: { include: { dieta: true } }, mae: true, resumo: true,
  // última pesagem corporal — vira `ultimoPesoKg` no DTO (desmame por peso)
  pesagens: { orderBy: { data: "desc" }, take: 1 },
} as const;
const d = (s?: string) => (s ? new Date(s) : undefined);

export async function listarAnimais(f: ListFiltros): Promise<AnimalDTO[]> {
  const where: any = {};
  if (f.status !== "TODOS") where.status = f.status;
  if (f.grupoId) where.grupoId = f.grupoId;
  if (f.setor) where.setor = f.setor;
  if (f.propriedadeId) where.propriedadeId = f.propriedadeId; // filtro por sítio (null = consolidado)
  // Busca por número, nome OU brinco eletrônico (A6 Fase 1 — o bastão RFID
  // digita o número da etiqueta no campo de busca).
  if (f.q) where.OR = [
    { numero: { contains: f.q, mode: "insensitive" } },
    { nome: { contains: f.q, mode: "insensitive" } },
    { brincoEletronico: { contains: f.q, mode: "insensitive" } },
  ];
  const rows = await prisma.animal.findMany({ where, include, orderBy: { numero: "asc" } });
  return rows.map(toAnimalDTO);
}

export async function listarSetores(): Promise<string[]> {
  const rows = await prisma.animal.findMany({
    where: { setor: { not: null } },
    select: { setor: true },
    distinct: ["setor"],
    orderBy: { setor: "asc" },
  });
  return rows.map((a) => a.setor!);
}

export async function obterAnimal(id: number): Promise<AnimalDTO | null> {
  const row = await prisma.animal.findUnique({ where: { id }, include });
  return row ? toAnimalDTO(row) : null;
}

async function assertRefs(input: { racaId?: number; grupoId?: number; maeId?: number; propriedadeId?: number }) {
  if (input.racaId && !(await prisma.raca.findUnique({ where: { id: input.racaId } }))) throw new AnimalError("REF_INVALIDA", "raça inexistente");
  if (input.grupoId && !(await prisma.grupo.findUnique({ where: { id: input.grupoId } }))) throw new AnimalError("REF_INVALIDA", "grupo inexistente");
  if (input.maeId && !(await prisma.animal.findUnique({ where: { id: input.maeId } }))) throw new AnimalError("REF_INVALIDA", "mãe inexistente");
  if (input.propriedadeId && !(await prisma.propriedade.findUnique({ where: { id: input.propriedadeId } }))) throw new AnimalError("REF_INVALIDA", "propriedade inexistente");
}

export async function criarAnimal(input: CriarAnimalInput): Promise<AnimalDTO> {
  if (await prisma.animal.findUnique({ where: { numero: input.numero } })) throw new AnimalError("NUMERO_DUPLICADO", `número ${input.numero} já existe`);
  await assertRefs(input);
  const row = await prisma.animal.create({
    data: {
      numero: input.numero, nome: input.nome, sexo: input.sexo, categoria: input.categoria,
      racaId: input.racaId, grauSangue: input.grauSangue,
      dataNascimento: d(input.dataNascimento), dataEntrada: new Date(input.dataEntrada),
      brincoEletronico: input.brincoEletronico, sisbov: input.sisbov,
      maeId: input.maeId, paiNome: input.paiNome, grupoId: input.grupoId, setor: input.setor,
      propriedadeId: input.propriedadeId ?? (await propriedadePrincipalId()), // sítio ativo ou principal
      resumo: { create: { statusReprodutivo: "VAZIA" } },
    },
    include,
  });
  return toAnimalDTO(row);
}

export async function editarAnimal(id: number, input: EditarAnimalInput): Promise<AnimalDTO> {
  const existing = await prisma.animal.findUnique({ where: { id } });
  if (!existing) throw new AnimalError("NAO_ENCONTRADO", "animal não encontrado");
  if (input.numero && input.numero !== existing.numero && (await prisma.animal.findUnique({ where: { numero: input.numero } }))) throw new AnimalError("NUMERO_DUPLICADO", `número ${input.numero} já existe`);
  await assertRefs(input);
  const row = await prisma.animal.update({
    where: { id },
    data: {
      numero: input.numero, nome: input.nome, sexo: input.sexo, categoria: input.categoria,
      racaId: input.racaId, grauSangue: input.grauSangue,
      dataNascimento: d(input.dataNascimento), dataEntrada: d(input.dataEntrada),
      brincoEletronico: input.brincoEletronico, sisbov: input.sisbov,
      maeId: input.maeId, paiNome: input.paiNome, grupoId: input.grupoId, setor: input.setor,
      propriedadeId: input.propriedadeId, // undefined = não mexe; setado = move de sítio
    },
    include,
  });
  return toAnimalDTO(row);
}

export async function darBaixa(id: number, input: BaixaInput): Promise<AnimalDTO> {
  if (!(await prisma.animal.findUnique({ where: { id } }))) throw new AnimalError("NAO_ENCONTRADO", "animal não encontrado");
  const row = await prisma.animal.update({
    where: { id },
    data: { status: "BAIXADO", dataBaixa: input.data ? new Date(input.data) : new Date(), motivoBaixa: input.motivo },
    include,
  });
  return toAnimalDTO(row);
}

export async function listarGrupos(): Promise<GrupoDTO[]> {
  return prisma.grupo.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}
export async function listarRacas(): Promise<RacaDTO[]> {
  return prisma.raca.findMany({ orderBy: [{ especie: "asc" }, { nome: "asc" }], select: { id: true, nome: true, codigo: true, especie: true } });
}
