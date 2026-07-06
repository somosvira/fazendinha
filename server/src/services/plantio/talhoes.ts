import { prisma } from "../../db.js";
import { toTalhaoDTO } from "./mappers.js";
import type { Talhao } from "./mock.js";
import type { CriarTalhaoInput, EditarTalhaoInput, BaixaInput, ListFiltros } from "./schemas.js";

export class TalhaoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CODIGO_DUPLICADO" | "REF_INVALIDA", message: string) {
    super(message);
  }
}

const include = { variedade: true, lavoura: true, resumo: true } as const;
const d = (s?: string) => (s ? new Date(s) : undefined);

export async function listarTalhoes(f: ListFiltros, propriedadeId?: number | null): Promise<Talhao[]> {
  const where: any = {};
  if (f.estado !== "TODOS") where.estado = f.estado;
  if (f.lavoura) where.lavoura = { nome: f.lavoura };
  if (propriedadeId != null) where.propriedadeId = propriedadeId; // escopo do sítio
  if (f.q) where.OR = [{ codigo: { contains: f.q, mode: "insensitive" } }, { nome: { contains: f.q, mode: "insensitive" } }];
  const rows = await prisma.talhao.findMany({ where, include, orderBy: { codigo: "asc" } });
  return rows.map(toTalhaoDTO);
}

export async function obterTalhao(id: number): Promise<Talhao | null> {
  const row = await prisma.talhao.findUnique({ where: { id }, include });
  return row ? toTalhaoDTO(row) : null;
}

async function assertRefs(input: { variedadeId?: number; lavouraId?: number }) {
  if (input.variedadeId && !(await prisma.variedadeCafe.findUnique({ where: { id: input.variedadeId } }))) throw new TalhaoError("REF_INVALIDA", "variedade inexistente");
  if (input.lavouraId && !(await prisma.lavoura.findUnique({ where: { id: input.lavouraId } }))) throw new TalhaoError("REF_INVALIDA", "lavoura inexistente");
}

export async function criarTalhao(input: CriarTalhaoInput, propriedadeId?: number | null): Promise<Talhao> {
  if (await prisma.talhao.findUnique({ where: { codigo: input.codigo } })) throw new TalhaoError("CODIGO_DUPLICADO", `código ${input.codigo} já existe`);
  await assertRefs(input);
  const row = await prisma.talhao.create({
    data: {
      codigo: input.codigo, nome: input.nome, variedadeId: input.variedadeId, lavouraId: input.lavouraId,
      espacamento: input.espacamento, plantasHa: input.plantasHa, areaHa: input.areaHa, anoPlantio: input.anoPlantio,
      altitude: input.altitude, exposicao: input.exposicao, declive: input.declive, irrigado: input.irrigado, estado: input.estado,
      dataPlantio: new Date(input.dataPlantio), ultimaRecepa: d(input.ultimaRecepa), observacao: input.observacao,
      propriedadeId: propriedadeId ?? null, // sítio ativo (multi-propriedade)
      resumo: { create: { fase: "REPOUSO" } },
    },
    include,
  });
  return toTalhaoDTO(row);
}

export async function editarTalhao(id: number, input: EditarTalhaoInput): Promise<Talhao> {
  const existing = await prisma.talhao.findUnique({ where: { id } });
  if (!existing) throw new TalhaoError("NAO_ENCONTRADO", "talhão não encontrado");
  if (input.codigo && input.codigo !== existing.codigo && (await prisma.talhao.findUnique({ where: { codigo: input.codigo } }))) throw new TalhaoError("CODIGO_DUPLICADO", `código ${input.codigo} já existe`);
  await assertRefs(input);
  const row = await prisma.talhao.update({
    where: { id },
    data: {
      codigo: input.codigo, nome: input.nome, variedadeId: input.variedadeId, lavouraId: input.lavouraId,
      espacamento: input.espacamento, plantasHa: input.plantasHa, areaHa: input.areaHa, anoPlantio: input.anoPlantio,
      altitude: input.altitude, exposicao: input.exposicao, declive: input.declive, irrigado: input.irrigado, estado: input.estado,
      dataPlantio: d(input.dataPlantio), ultimaRecepa: d(input.ultimaRecepa), observacao: input.observacao,
    },
    include,
  });
  return toTalhaoDTO(row);
}

export async function darBaixa(id: number, input: BaixaInput): Promise<Talhao> {
  if (!(await prisma.talhao.findUnique({ where: { id } }))) throw new TalhaoError("NAO_ENCONTRADO", "talhão não encontrado");
  const row = await prisma.talhao.update({
    where: { id },
    data: { estado: "BAIXADO", dataBaixa: input.data ? new Date(input.data) : new Date(), motivoBaixa: input.motivo },
    include,
  });
  return toTalhaoDTO(row);
}
