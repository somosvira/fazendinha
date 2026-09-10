import { prisma } from "../../db.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { registrarMovimentacoes } from "./movimentacao.js";
import { entityIdSchema } from "@fazendinha/shared";

export const dietaSchema = z.object({
  nome: z.string().min(1).max(60),
  descricao: z.string().max(200).optional(),
  pb: z.number().min(0, "% PB deve ser ≥ 0").max(999.9, "% PB deve ser menor que 1000").optional(),
  edMcal: z.number().min(0, "Energia deve ser ≥ 0").max(99.99, "Energia (Mcal/kg) deve ser menor que 100 — valores típicos de ração ficam entre 2 e 4").optional(),
});
export type DietaInput = z.infer<typeof dietaSchema>;

export const loteSchema = z.object({
  nome: z.string().min(1).max(60),
  dietaId: z.number().int().nullable().optional(),
  animalIds: z.array(z.number().int()).default([]),
});
export type LoteInput = z.infer<typeof loteSchema>;

export class NutricaoError extends Error { constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO" | "EM_USO" | "SEM_DIETA" | "JA_FECHADO" | "MES_FECHADO" | "PERIODO_INVALIDO" | "ANIMAL_FORA_ESCOPO", message: string) { super(message); } }

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

export async function listarLotes(propriedadeId: number | null = null) {
  const grupos = await prisma.grupo.findMany({ where: propriedadeId != null ? { propriedadeId } : {}, orderBy: { nome: "asc" }, include: { dieta: true, animais: { where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { resumo: true } } } });
  return grupos.map((g) => {
    const prods = g.animais.map((a) => (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null)).filter((x): x is number => x != null);
    return { id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null, numAnimais: g.animais.length, producaoMedia: prods.length ? Math.round((prods.reduce((a, b) => a + b, 0) / prods.length) * 10) / 10 : null };
  });
}

export async function obterLote(id: number, propriedadeId: number | null = null) {
  const g = await prisma.grupo.findFirst({ where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { dieta: true, animais: { where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, orderBy: { numero: "asc" } } } });
  if (!g) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  return {
    id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null,
    animais: g.animais.map((a) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria })),
  };
}

export async function listarAnimaisDisponiveis(propriedadeId: number | null = null) {
  const rows = await prisma.animal.findMany({
    where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) },
    select: { id: true, numero: true, nome: true, categoria: true, grupoId: true, grupo: { select: { nome: true } } },
    orderBy: { numero: "asc" },
  });
  return rows.map((a) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria, grupoId: a.grupoId, grupoNome: a.grupo?.nome ?? null }));
}

async function assertDieta(dietaId: number | null | undefined) {
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
}

type AnimalAlocacao = {
  id: number;
  propriedadeId: number | null;
  grupoId: number | null;
  setor: string | null;
  grupo: { nome: string } | null;
};

async function animaisNoEscopo(ids: number[], propriedadeId: number, tx: Prisma.TransactionClient): Promise<AnimalAlocacao[]> {
  if (!ids.length) return [];
  const animais = await tx.animal.findMany({
    where: { id: { in: ids }, propriedadeId },
    select: { id: true, propriedadeId: true, grupoId: true, setor: true, grupo: { select: { nome: true } } },
  });
  if (animais.length !== ids.length) throw new NutricaoError("ANIMAL_FORA_ESCOPO", "um ou mais animais não pertencem à propriedade ativa");
  return animais;
}

async function moverAnimal(
  tx: Prisma.TransactionClient,
  animal: AnimalAlocacao,
  grupoId: number | null,
  grupoNome: string | null,
  propriedadeId: number,
) {
  if (animal.grupoId === grupoId) return;
  await tx.animal.update({ where: { id: animal.id }, data: { grupoId } });
  await registrarMovimentacoes(
    tx,
    animal.id,
    { grupoId: animal.grupoId, grupoNome: animal.grupo?.nome ?? null, setor: animal.setor },
    { grupoId, grupoNome, setor: undefined },
    { propriedadeId, motivo: "edição do lote" },
  );
}

export async function criarLote(input: LoteInput, propriedadeId: number) {
  const ids = [...new Set(input.animalIds ?? [])];
  return prisma.$transaction(async (tx) => {
    if (await tx.grupo.findFirst({ where: { nome: input.nome, propriedadeId } })) throw new NutricaoError("NOME_DUPLICADO", `lote ${input.nome} já existe`);
    if (input.dietaId != null && !(await tx.dieta.findUnique({ where: { id: input.dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
    const animais = await animaisNoEscopo(ids, propriedadeId, tx);
    const g = await tx.grupo.create({ data: { nome: input.nome, dietaId: input.dietaId ?? null, propriedadeId } });
    for (const animal of animais) await moverAnimal(tx, animal, g.id, input.nome, propriedadeId);
    return obterLoteTx(tx, g.id, propriedadeId);
  });
}

export async function editarLote(id: number, input: LoteInput, propriedadeId: number) {
  const novosIds = [...new Set(input.animalIds ?? [])];
  return prisma.$transaction(async (tx) => {
    const grupo = await tx.grupo.findFirst({ where: { id, propriedadeId } });
    if (!grupo) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
    const homonimo = await tx.grupo.findFirst({ where: { nome: input.nome, propriedadeId, id: { not: id } } });
    if (homonimo) throw new NutricaoError("NOME_DUPLICADO", `lote ${input.nome} já existe`);
    if (input.dietaId != null && !(await tx.dieta.findUnique({ where: { id: input.dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
    const selecionados = await animaisNoEscopo(novosIds, propriedadeId, tx);
    await tx.grupo.update({ where: { id }, data: { nome: input.nome, dietaId: input.dietaId ?? null } });
    const atuais = await tx.animal.findMany({
      where: { grupoId: id, propriedadeId },
      select: { id: true, propriedadeId: true, grupoId: true, setor: true, grupo: { select: { nome: true } } },
    });
    const novosSet = new Set(novosIds);
    for (const animal of atuais) if (!novosSet.has(animal.id)) await moverAnimal(tx, animal, null, null, propriedadeId);
    const atuaisSet = new Set(atuais.map((a) => a.id));
    for (const animal of selecionados) if (!atuaisSet.has(animal.id)) await moverAnimal(tx, animal, id, input.nome, propriedadeId);
    return obterLoteTx(tx, id, propriedadeId);
  });
}

async function obterLoteTx(tx: Prisma.TransactionClient, id: number, propriedadeId: number) {
  const g = await tx.grupo.findUnique({ where: { id }, include: { dieta: true, animais: { where: { status: "ATIVO", propriedadeId }, orderBy: { numero: "asc" } } } });
  if (!g) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  return {
    id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null,
    animais: g.animais.map((a: any) => ({ id: a.id, numero: a.numero, nome: a.nome, categoria: a.categoria })),
  };
}

export async function excluirLote(id: number, propriedadeId: number | null = null) {
  if (!(await prisma.grupo.findFirst({ where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  const animais = await prisma.animal.count({ where: { grupoId: id } });
  if (animais > 0) throw new NutricaoError("EM_USO", `lote tem ${animais} ${animais > 1 ? "animais" : "animal"} — remova-os antes de excluir`);
  const producoes = await prisma.producaoLote.count({ where: { grupoId: id } });
  if (producoes > 0) throw new NutricaoError("EM_USO", `lote tem ${producoes} registro${producoes > 1 ? "s" : ""} de produção — não pode ser excluído`);
  const movs = await prisma.movimentoEstoque.count({ where: { grupoId: id } });
  if (movs > 0) throw new NutricaoError("EM_USO", `lote tem ${movs} movimentação${movs > 1 ? "ões" : ""} de estoque — não pode ser excluído`);
  await prisma.grupo.delete({ where: { id } });
}

export async function atribuirDieta(grupoId: number, dietaId: number | null, propriedadeId: number | null = null) {
  if (!(await prisma.grupo.findFirst({ where: { id: grupoId, ...(propriedadeId != null ? { propriedadeId } : {}) } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  await prisma.grupo.update({ where: { id: grupoId }, data: { dietaId } });
}

// ── Composição da dieta (DietaItem) ─────────────────────────────────────────
// Quanto de cada produto por cabeça/dia. É o que o motor de consumo (Fatia 2)
// multiplica por cabeças × dias para baixar do estoque.

// Decimal(12,4) → cabe até 8 dígitos inteiros; capamos bem abaixo por sanidade.
const MAX_QTD_CAB_DIA = 100_000;

export const dietaItensSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: entityIdSchema,
        qtdPorCabecaDia: z.number().positive("quantidade por cabeça/dia deve ser maior que zero").max(MAX_QTD_CAB_DIA, "quantidade por cabeça/dia muito alta"),
      }),
    )
    .max(100, "composição com itens demais"),
});
export type DietaItensInput = z.infer<typeof dietaItensSchema>;

const dietaItemDTO = (i: any) => ({
  id: i.id,
  produtoId: i.produtoId,
  produtoNome: i.produto?.nome ?? null,
  unidade: i.unidade as string,
  qtdPorCabecaDia: Number(i.qtdPorCabecaDia),
  custoUnitario: i.produto?.custoUnitario != null ? Number(i.produto.custoUnitario) : null,
  setor: i.produto?.setor ?? null,
  ordem: i.ordem as number,
});

export async function listarItensDieta(dietaId: number) {
  if (!(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  const itens = await prisma.dietaItem.findMany({ where: { dietaId }, orderBy: { ordem: "asc" }, include: { produto: true } });
  return itens.map(dietaItemDTO);
}

// Substitui a composição inteira (delete + recreate numa transação). Em v1 a
// unidade do item é sempre a do produto (decisão: dieta e estoque na mesma unidade).
export async function substituirItensDieta(dietaId: number, input: DietaItensInput) {
  if (!(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");

  const ids = input.itens.map((i) => i.produtoId);
  if (new Set(ids).size !== ids.length) throw new NutricaoError("NOME_DUPLICADO", "produto repetido na composição — cada produto entra uma vez");

  const produtos = ids.length ? await prisma.produto.findMany({ where: { id: { in: ids } } }) : [];
  const porId = new Map(produtos.map((p) => [p.id, p]));
  for (const it of input.itens) {
    const p = porId.get(it.produtoId);
    if (!p) throw new NutricaoError("NAO_ENCONTRADO", `produto ${it.produtoId} não encontrado`);
    if (!p.estocavel) throw new NutricaoError("EM_USO", `produto "${p.nome}" não é estocável — não pode compor uma dieta`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.dietaItem.deleteMany({ where: { dietaId } });
    if (input.itens.length) {
      await tx.dietaItem.createMany({
        data: input.itens.map((it, ordem) => ({
          dietaId,
          produtoId: it.produtoId,
          qtdPorCabecaDia: it.qtdPorCabecaDia,
          unidade: porId.get(it.produtoId)!.unidade, // v1: unidade = a do produto
          ordem,
        })),
      });
    }
  });
  return listarItensDieta(dietaId);
}
