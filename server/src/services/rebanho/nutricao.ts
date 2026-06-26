import { prisma } from "../../db.js";
import { z } from "zod";

export const dietaSchema = z.object({ nome: z.string().min(1).max(60), descricao: z.string().max(200).optional(), pb: z.number().optional(), edMcal: z.number().optional() });
export type DietaInput = z.infer<typeof dietaSchema>;

export const loteSchema = z.object({
  nome: z.string().min(1).max(60),
  dietaId: z.number().int().nullable().optional(),
  animalIds: z.array(z.number().int()).default([]),
});
export type LoteInput = z.infer<typeof loteSchema>;

export class NutricaoError extends Error { constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO" | "EM_USO", message: string) { super(message); } }

const dietaDTO = (d: any) => ({ id: d.id, nome: d.nome, descricao: d.descricao ?? null, pb: d.pb != null ? Number(d.pb) : null, edMcal: d.edMcal != null ? Number(d.edMcal) : null, ativo: d.ativo });

export async function listarDietas() { return (await prisma.dieta.findMany({ orderBy: { nome: "asc" } })).map(dietaDTO); }
export async function criarDieta(input: DietaInput) {
  if (await prisma.dieta.findUnique({ where: { nome: input.nome } })) throw new NutricaoError("NOME_DUPLICADO", `dieta ${input.nome} já existe`);
  return dietaDTO(await prisma.dieta.create({ data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function editarDieta(id: number, input: DietaInput) {
  if (!(await prisma.dieta.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  const homonima = await prisma.dieta.findUnique({ where: { nome: input.nome } });
  if (homonima && homonima.id !== id) throw new NutricaoError("NOME_DUPLICADO", `dieta ${input.nome} já existe`);
  return dietaDTO(await prisma.dieta.update({ where: { id }, data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function excluirDieta(id: number) {
  if (!(await prisma.dieta.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  const usos = await prisma.grupo.count({ where: { dietaId: id } });
  if (usos > 0) throw new NutricaoError("EM_USO", `dieta em uso por ${usos} lote${usos > 1 ? "s" : ""}`);
  await prisma.dieta.delete({ where: { id } });
}

export async function listarLotes() {
  const grupos = await prisma.grupo.findMany({ orderBy: { nome: "asc" }, include: { dieta: true, animais: { where: { status: "ATIVO" }, include: { resumo: true } } } });
  return grupos.map((g) => {
    const prods = g.animais.map((a) => (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null)).filter((x): x is number => x != null);
    return { id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null, numAnimais: g.animais.length, producaoMedia: prods.length ? Math.round((prods.reduce((a, b) => a + b, 0) / prods.length) * 10) / 10 : null };
  });
}

export async function obterLote(id: number) {
  const g = await prisma.grupo.findUnique({ where: { id }, include: { dieta: true, animais: { where: { status: "ATIVO" }, orderBy: { numero: "asc" } } } });
  if (!g) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  return {
    id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null,
    animais: g.animais.map((a) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria })),
  };
}

export async function listarAnimaisDisponiveis() {
  const rows = await prisma.animal.findMany({
    where: { status: "ATIVO" },
    select: { id: true, numero: true, nome: true, categoria: true, grupoId: true, grupo: { select: { nome: true } } },
    orderBy: { numero: "asc" },
  });
  return rows.map((a) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria, grupoId: a.grupoId, grupoNome: a.grupo?.nome ?? null }));
}

async function assertDieta(dietaId: number | null | undefined) {
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
}

export async function criarLote(input: LoteInput) {
  if (await prisma.grupo.findUnique({ where: { nome: input.nome } })) throw new NutricaoError("NOME_DUPLICADO", `lote ${input.nome} já existe`);
  await assertDieta(input.dietaId);
  const ids = input.animalIds ?? [];
  return prisma.$transaction(async (tx) => {
    const g = await tx.grupo.create({ data: { nome: input.nome, dietaId: input.dietaId ?? null } });
    if (ids.length) await tx.animal.updateMany({ where: { id: { in: ids } }, data: { grupoId: g.id } });
    return obterLoteTx(tx, g.id);
  });
}

export async function editarLote(id: number, input: LoteInput) {
  if (!(await prisma.grupo.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  const homonimo = await prisma.grupo.findUnique({ where: { nome: input.nome } });
  if (homonimo && homonimo.id !== id) throw new NutricaoError("NOME_DUPLICADO", `lote ${input.nome} já existe`);
  await assertDieta(input.dietaId);
  const novosIds = new Set(input.animalIds ?? []);
  return prisma.$transaction(async (tx) => {
    await tx.grupo.update({ where: { id }, data: { nome: input.nome, dietaId: input.dietaId ?? null } });
    const atuais = await tx.animal.findMany({ where: { grupoId: id }, select: { id: true } });
    const atuaisSet = new Set(atuais.map((a) => a.id));
    const remover = atuais.filter((a) => !novosIds.has(a.id)).map((a) => a.id);
    const adicionar = [...novosIds].filter((aid) => !atuaisSet.has(aid));
    if (remover.length) await tx.animal.updateMany({ where: { id: { in: remover } }, data: { grupoId: null } });
    if (adicionar.length) await tx.animal.updateMany({ where: { id: { in: adicionar } }, data: { grupoId: id } });
    return obterLoteTx(tx, id);
  });
}

async function obterLoteTx(tx: any, id: number) {
  const g = await tx.grupo.findUnique({ where: { id }, include: { dieta: true, animais: { where: { status: "ATIVO" }, orderBy: { numero: "asc" } } } });
  return {
    id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null,
    animais: g.animais.map((a: any) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria })),
  };
}

export async function excluirLote(id: number) {
  if (!(await prisma.grupo.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  const animais = await prisma.animal.count({ where: { grupoId: id } });
  if (animais > 0) throw new NutricaoError("EM_USO", `lote tem ${animais} ${animais > 1 ? "animais" : "animal"} — remova-os antes de excluir`);
  const producoes = await prisma.producaoLote.count({ where: { grupoId: id } });
  if (producoes > 0) throw new NutricaoError("EM_USO", `lote tem ${producoes} registro${producoes > 1 ? "s" : ""} de produção — não pode ser excluído`);
  const movs = await prisma.movimentoEstoque.count({ where: { grupoId: id } });
  if (movs > 0) throw new NutricaoError("EM_USO", `lote tem ${movs} movimentação${movs > 1 ? "ões" : ""} de estoque — não pode ser excluído`);
  await prisma.grupo.delete({ where: { id } });
}

export async function atribuirDieta(grupoId: number, dietaId: number | null) {
  if (!(await prisma.grupo.findUnique({ where: { id: grupoId } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  await prisma.grupo.update({ where: { id: grupoId }, data: { dietaId } });
}
