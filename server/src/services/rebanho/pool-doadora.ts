import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { AplicarPoolInput, CriarGrupoPoolInput } from "./pool-doadora.schemas.js";

export class PoolDoadoraError extends Error { constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) { super(message); } }
const filtroPropriedade = (propriedadeId: number | null) => propriedadeId != null ? { propriedadeId } : {};
const GRUPO_INCLUDE = { itens: { include: { doadora: { select: { id: true, numero: true, nome: true, status: true } } }, orderBy: { doadoraId: "asc" as const } }, aplicacoes: { orderBy: { data: "desc" as const } } };
async function validarDoadoras(ids: readonly number[], propriedadeId: number | null) {
  if (new Set(ids).size !== ids.length) throw new PoolDoadoraError("CONFLITO", "doadora duplicada no pool");
  const animais = await prisma.animal.findMany({ where: { id: { in: [...ids] }, ...filtroPropriedade(propriedadeId) }, select: { id: true } });
  if (animais.length !== ids.length) throw new PoolDoadoraError("NAO_ENCONTRADO", "uma ou mais doadoras não foram encontradas");
}
export async function listarGruposPool(propriedadeId: number | null) { return prisma.grupoPoolDoadora.findMany({ where: filtroPropriedade(propriedadeId), include: GRUPO_INCLUDE, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }); }
export async function criarGrupoPool(input: CriarGrupoPoolInput, propriedadeId: number | null) {
  await validarDoadoras(input.doadoraIds, propriedadeId);
  return prisma.$transaction((tx) => tx.grupoPoolDoadora.create({ data: { nome: input.nome, propriedadeId, itens: { create: input.doadoraIds.map((doadoraId) => ({ doadoraId })) } }, include: GRUPO_INCLUDE }));
}
export async function atualizarGrupoPool(id: number, input: { nome?: string; ativo?: boolean }, propriedadeId: number | null) {
  if (!(await prisma.grupoPoolDoadora.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, select: { id: true } }))) throw new PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado");
  return prisma.grupoPoolDoadora.update({ where: { id }, data: input, include: GRUPO_INCLUDE });
}
export async function salvarItensGrupoPool(id: number, doadoraIds: number[], propriedadeId: number | null) {
  if (!(await prisma.grupoPoolDoadora.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, select: { id: true } }))) throw new PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado");
  await validarDoadoras(doadoraIds, propriedadeId);
  return prisma.$transaction(async (tx) => {
    await tx.itemGrupoPoolDoadora.deleteMany({ where: { grupoId: id } });
    await tx.itemGrupoPoolDoadora.createMany({ data: doadoraIds.map((doadoraId) => ({ grupoId: id, doadoraId })) });
    return tx.grupoPoolDoadora.update({ where: { id }, data: {}, include: GRUPO_INCLUDE });
  });
}
export async function aplicarPool(id: number, input: AplicarPoolInput, propriedadeId: number | null): Promise<{ aplicacaoId: number; coletasCriadas: number }> {
  const grupo = await prisma.grupoPoolDoadora.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, include: { itens: { where: { ativo: true }, select: { doadoraId: true, ativo: true } } } });
  if (!grupo) throw new PoolDoadoraError("NAO_ENCONTRADO", "grupo de doadoras não encontrado");
  if (!grupo.ativo) throw new PoolDoadoraError("CONFLITO", "grupo de doadoras inativo");
  if (grupo.itens.length === 0) throw new PoolDoadoraError("CONFLITO", "grupo sem doadoras ativas");
  try {
    return await prisma.$transaction(async (tx) => {
      const data = new Date(`${input.data}T00:00:00Z`);
      const aplicacao = await tx.aplicacaoPoolDoadora.create({ data: { grupoId: id, data, tecnico: input.tecnico, propriedadeId }, select: { id: true } });
      const coletas = grupo.itens.map(({ doadoraId }) => ({ doadoraId, data, tecnico: input.tecnico, metodo: "FIV", status: "RASCUNHO", aplicacaoPoolId: aplicacao.id, propriedadeId }));
      await tx.coleta.createMany({ data: coletas });
      return { aplicacaoId: aplicacao.id, coletasCriadas: coletas.length };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new PoolDoadoraError("CONFLITO", "pool já aplicado nesta data");
    throw e;
  }
}
