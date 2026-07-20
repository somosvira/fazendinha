import { prisma } from "../../db.js";
import { derivarComposicao, type PrincipioComposicao } from "./composicao.calc.js";
import type { CriarPrincipioInput, AtualizarPrincipioInput, DefinirComposicaoInput } from "./principio-ativo.schemas.js";

export class PrincipioError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO", message: string) { super(message); }
}

export interface PrincipioAtivoDTO {
  id: number;
  nome: string;
  ehAntibiotico: boolean;
  carenciaLeiteHoras: number | null;
  carenciaCarneDias: number | null;
  ativo: boolean;
  usoEmProdutos: number; // em quantos produtos este princípio aparece
}

export interface ComposicaoProdutoDTO {
  produtoId: number;
  produtoNome: string;
  principios: { principioAtivoId: number; nome: string; concentracao: string | null; ehAntibiotico: boolean }[];
  // Derivado da composição (composicao.calc): flags no nível do produto.
  ehAntibiotico: boolean;
  carenciaLeiteHorasSugerida: number | null;
  carenciaCarneDiasSugerida: number | null;
}

// ── Catálogo de princípios ativos ─────────────────────────────────────────────

export async function listarPrincipios(incluirInativos = false): Promise<PrincipioAtivoDTO[]> {
  const rows = await prisma.principioAtivo.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { produtos: true } } },
  });
  return rows.map((p) => ({
    id: p.id, nome: p.nome, ehAntibiotico: p.ehAntibiotico,
    carenciaLeiteHoras: p.carenciaLeiteHoras, carenciaCarneDias: p.carenciaCarneDias,
    ativo: p.ativo, usoEmProdutos: p._count.produtos,
  }));
}

export async function criarPrincipio(input: CriarPrincipioInput): Promise<PrincipioAtivoDTO> {
  if (await prisma.principioAtivo.findUnique({ where: { nome: input.nome } })) throw new PrincipioError("NOME_DUPLICADO", `princípio ativo "${input.nome}" já existe`);
  const p = await prisma.principioAtivo.create({
    data: {
      nome: input.nome,
      ehAntibiotico: input.ehAntibiotico ?? false,
      carenciaLeiteHoras: input.carenciaLeiteHoras ?? null,
      carenciaCarneDias: input.carenciaCarneDias ?? null,
      ativo: input.ativo ?? true,
    },
    include: { _count: { select: { produtos: true } } },
  });
  return { id: p.id, nome: p.nome, ehAntibiotico: p.ehAntibiotico, carenciaLeiteHoras: p.carenciaLeiteHoras, carenciaCarneDias: p.carenciaCarneDias, ativo: p.ativo, usoEmProdutos: p._count.produtos };
}

export async function atualizarPrincipio(id: number, input: AtualizarPrincipioInput): Promise<PrincipioAtivoDTO> {
  if (!(await prisma.principioAtivo.findUnique({ where: { id } }))) throw new PrincipioError("NAO_ENCONTRADO", "princípio ativo não encontrado");
  if (input.nome && (await prisma.principioAtivo.findFirst({ where: { nome: input.nome, id: { not: id } } }))) throw new PrincipioError("NOME_DUPLICADO", `princípio ativo "${input.nome}" já existe`);
  const p = await prisma.principioAtivo.update({
    where: { id },
    data: {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.ehAntibiotico !== undefined ? { ehAntibiotico: input.ehAntibiotico } : {}),
      ...(input.carenciaLeiteHoras !== undefined ? { carenciaLeiteHoras: input.carenciaLeiteHoras } : {}),
      ...(input.carenciaCarneDias !== undefined ? { carenciaCarneDias: input.carenciaCarneDias } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    },
    include: { _count: { select: { produtos: true } } },
  });
  return { id: p.id, nome: p.nome, ehAntibiotico: p.ehAntibiotico, carenciaLeiteHoras: p.carenciaLeiteHoras, carenciaCarneDias: p.carenciaCarneDias, ativo: p.ativo, usoEmProdutos: p._count.produtos };
}

export async function excluirPrincipio(id: number): Promise<void> {
  if (!(await prisma.principioAtivo.findUnique({ where: { id } }))) throw new PrincipioError("NAO_ENCONTRADO", "princípio ativo não encontrado");
  const emUso = await prisma.produtoPrincipioAtivo.count({ where: { principioAtivoId: id } });
  if (emUso > 0) {
    // Preserva a composição: princípio em uso só é inativado, não apagado.
    await prisma.principioAtivo.update({ where: { id }, data: { ativo: false } });
    return;
  }
  await prisma.principioAtivo.delete({ where: { id } });
}

// ── Composição de um produto ──────────────────────────────────────────────────

export async function obterComposicao(produtoId: number): Promise<ComposicaoProdutoDTO> {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { principiosAtivos: { include: { principioAtivo: true } } },
  });
  if (!produto) throw new PrincipioError("NAO_ENCONTRADO", "produto não encontrado");

  const principios = produto.principiosAtivos.map((pp) => ({
    principioAtivoId: pp.principioAtivoId,
    nome: pp.principioAtivo.nome,
    concentracao: pp.concentracao,
    ehAntibiotico: pp.principioAtivo.ehAntibiotico,
  }));
  const paraCalc: PrincipioComposicao[] = produto.principiosAtivos.map((pp) => ({
    nome: pp.principioAtivo.nome,
    ehAntibiotico: pp.principioAtivo.ehAntibiotico,
    carenciaLeiteHoras: pp.principioAtivo.carenciaLeiteHoras,
    carenciaCarneDias: pp.principioAtivo.carenciaCarneDias,
  }));
  const derivada = derivarComposicao(paraCalc);
  return {
    produtoId: produto.id,
    produtoNome: produto.nome,
    principios,
    ehAntibiotico: derivada.ehAntibiotico,
    carenciaLeiteHorasSugerida: derivada.carenciaLeiteHorasSugerida,
    carenciaCarneDiasSugerida: derivada.carenciaCarneDiasSugerida,
  };
}

// Substitui a composição inteira do produto (o front sempre manda a lista completa).
export async function definirComposicao(produtoId: number, input: DefinirComposicaoInput): Promise<ComposicaoProdutoDTO> {
  if (!(await prisma.produto.findUnique({ where: { id: produtoId } }))) throw new PrincipioError("NAO_ENCONTRADO", "produto não encontrado");
  // Só princípios que existem entram (ignora ids fantasma); dedup por principioAtivoId.
  const ids = [...new Set(input.principios.map((p) => p.principioAtivoId))];
  const existentes = new Set((await prisma.principioAtivo.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id));
  const validos = input.principios.filter((p, i, arr) => existentes.has(p.principioAtivoId) && arr.findIndex((x) => x.principioAtivoId === p.principioAtivoId) === i);

  await prisma.$transaction(async (tx) => {
    await tx.produtoPrincipioAtivo.deleteMany({ where: { produtoId } });
    if (validos.length) {
      await tx.produtoPrincipioAtivo.createMany({
        data: validos.map((p) => ({ produtoId, principioAtivoId: p.principioAtivoId, concentracao: p.concentracao ?? null })),
      });
    }
  });
  return obterComposicao(produtoId);
}
