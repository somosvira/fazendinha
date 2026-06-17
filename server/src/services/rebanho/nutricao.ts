import { prisma } from "../../db.js";
import { z } from "zod";

export const dietaSchema = z.object({ nome: z.string().min(1).max(60), descricao: z.string().max(200).optional(), pb: z.number().optional(), edMcal: z.number().optional() });
export type DietaInput = z.infer<typeof dietaSchema>;
export class NutricaoError extends Error { constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO", message: string) { super(message); } }

const dietaDTO = (d: any) => ({ id: d.id, nome: d.nome, descricao: d.descricao ?? null, pb: d.pb != null ? Number(d.pb) : null, edMcal: d.edMcal != null ? Number(d.edMcal) : null, ativo: d.ativo });

export async function listarDietas() { return (await prisma.dieta.findMany({ orderBy: { nome: "asc" } })).map(dietaDTO); }
export async function criarDieta(input: DietaInput) {
  if (await prisma.dieta.findUnique({ where: { nome: input.nome } })) throw new NutricaoError("NOME_DUPLICADO", `dieta ${input.nome} já existe`);
  return dietaDTO(await prisma.dieta.create({ data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function editarDieta(id: number, input: DietaInput) {
  if (!(await prisma.dieta.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  return dietaDTO(await prisma.dieta.update({ where: { id }, data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function listarLotes() {
  const grupos = await prisma.grupo.findMany({ orderBy: { nome: "asc" }, include: { dieta: true, animais: { where: { status: "ATIVO" }, include: { resumo: true } } } });
  return grupos.map((g) => {
    const prods = g.animais.map((a) => (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null)).filter((x): x is number => x != null);
    return { id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null, numAnimais: g.animais.length, producaoMedia: prods.length ? Math.round((prods.reduce((a, b) => a + b, 0) / prods.length) * 10) / 10 : null };
  });
}
export async function atribuirDieta(grupoId: number, dietaId: number | null) {
  if (!(await prisma.grupo.findUnique({ where: { id: grupoId } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  await prisma.grupo.update({ where: { id: grupoId }, data: { dietaId } });
}
