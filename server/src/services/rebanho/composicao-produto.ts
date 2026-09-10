import { prisma } from "../../db.js";
import { resumoComposicao, type ResumoComposicaoProduto } from "./composicao-produto.calc.js";

export class ComposicaoProdutoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const num = (v: unknown): number => Number(v);

export interface ItemComposicaoDTO { ingredienteId: string; ingredienteNome: string; proporcao: number }
export interface ComposicaoRacaoDTO {
  produtoId: string;
  produtoNome: string;
  itens: ItemComposicaoDTO[];
  resumo: ResumoComposicaoProduto;
}
export interface DefinirComposicaoInput { itens: { id?: string; ingredienteId: string; proporcao: number }[] }

export async function obterComposicao(produtoId: string): Promise<ComposicaoRacaoDTO> {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { composicao: { include: { ingrediente: { select: { nome: true } } } } },
  });
  if (!produto) throw new ComposicaoProdutoError("NAO_ENCONTRADO", "produto não encontrado");
  const itens: ItemComposicaoDTO[] = produto.composicao.map((c) => ({ ingredienteId: c.ingredienteId, ingredienteNome: c.ingrediente.nome, proporcao: num(c.proporcao) }));
  return { produtoId: produto.id, produtoNome: produto.nome, itens, resumo: resumoComposicao(itens) };
}

// Substitui a receita inteira (o front sempre manda a lista completa). Veta o próprio produto
// como ingrediente e ids fantasma; dedup por ingredienteId.
export async function definirComposicao(produtoId: string, input: DefinirComposicaoInput): Promise<ComposicaoRacaoDTO> {
  if (!(await prisma.produto.findUnique({ where: { id: produtoId } }))) throw new ComposicaoProdutoError("NAO_ENCONTRADO", "produto não encontrado");
  const ids = [...new Set(input.itens.map((i) => i.ingredienteId))].filter((id) => id !== produtoId);
  const existentes = new Set((await prisma.produto.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id));
  const validos = input.itens.filter((i, idx, arr) =>
    i.ingredienteId !== produtoId && existentes.has(i.ingredienteId) && arr.findIndex((x) => x.ingredienteId === i.ingredienteId) === idx);

  await prisma.$transaction(async (tx) => {
    await tx.composicaoProdutoItem.deleteMany({ where: { produtoId } });
    if (validos.length) {
      await tx.composicaoProdutoItem.createMany({ data: validos.map((i) => ({ id: i.id, produtoId, ingredienteId: i.ingredienteId, proporcao: i.proporcao })) });
    }
  });
  return obterComposicao(produtoId);
}
