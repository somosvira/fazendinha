import { prisma } from "../../db.js";
import { toAreaCultivoDTO } from "./mappers.js";
import type { CriarAreaCultivoInput, EditarAreaCultivoInput, ListAreaCultivoFiltros } from "./schemas.js";

export class AreaCultivoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "REF_INVALIDA" | "CODIGO_DUPLICADO", message: string) {
    super(message);
  }
}

export async function listarAreasCultivo(f: ListAreaCultivoFiltros) {
  const where: any = {};
  if (f.safraCultivoId !== undefined) where.safraCultivoId = f.safraCultivoId;
  const rows = await prisma.areaCultivo.findMany({ where, orderBy: { codigo: "asc" } });
  return rows.map(toAreaCultivoDTO);
}

export async function obterAreaCultivo(id: number) {
  const row = await prisma.areaCultivo.findUnique({ where: { id } });
  return row ? toAreaCultivoDTO(row) : null;
}

async function assertSafraExiste(safraCultivoId: number) {
  if (!(await prisma.safraCultivo.findUnique({ where: { id: safraCultivoId } }))) {
    throw new AreaCultivoError("REF_INVALIDA", "safra de cultivo inexistente");
  }
}

async function assertCodigoLivre(safraCultivoId: number, codigo: string, excetoId?: number) {
  const existing = await prisma.areaCultivo.findUnique({ where: { safraCultivoId_codigo: { safraCultivoId, codigo } } });
  if (existing && existing.id !== excetoId) {
    throw new AreaCultivoError("CODIGO_DUPLICADO", `código ${codigo} já existe nessa safra`);
  }
}

export async function criarAreaCultivo(input: CriarAreaCultivoInput) {
  await assertSafraExiste(input.safraCultivoId);
  await assertCodigoLivre(input.safraCultivoId, input.codigo);
  const row = await prisma.areaCultivo.create({
    data: {
      safraCultivoId: input.safraCultivoId,
      codigo: input.codigo,
      nome: input.nome ?? undefined,
      areaHa: input.areaHa,
    },
  });
  return toAreaCultivoDTO(row);
}

export async function editarAreaCultivo(id: number, input: EditarAreaCultivoInput) {
  const existing = await prisma.areaCultivo.findUnique({ where: { id } });
  if (!existing) throw new AreaCultivoError("NAO_ENCONTRADO", "área de cultivo não encontrada");
  if (input.codigo) await assertCodigoLivre(existing.safraCultivoId, input.codigo, id);
  const row = await prisma.areaCultivo.update({
    where: { id },
    data: { codigo: input.codigo, nome: input.nome, areaHa: input.areaHa },
  });
  return toAreaCultivoDTO(row);
}

export async function excluirAreaCultivo(id: number) {
  if (!(await prisma.areaCultivo.findUnique({ where: { id } }))) {
    throw new AreaCultivoError("NAO_ENCONTRADO", "área de cultivo não encontrada");
  }
  await prisma.areaCultivo.delete({ where: { id } });
}
