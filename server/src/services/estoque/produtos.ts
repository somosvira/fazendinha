import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { papeisDoParceiro } from "../financeiro/papeis.js";
import { auditar, FinanceiroError, traduzirConflitoUnico, type DbFinanceiro } from "../financeiro/regras.js";
import type { ProdutoInput, ProdutoPatchInput } from "./produtos.schemas.js";

export const includeProduto = {
  fornecedores: {
    include: { fornecedor: { include: { papeis: true } } },
    orderBy: { fornecedor: { nome: "asc" as const } },
  },
  centrosCusto: { include: { centroCusto: true }, orderBy: { centroCusto: { nome: "asc" as const } } },
  categoria: true,
} as const;

export function produtoDTO(produto: Prisma.ProdutoGetPayload<{ include: typeof includeProduto }>) {
  return {
    id: produto.id,
    nome: produto.nome,
    unidade: produto.unidade,
    estocavel: produto.estocavel,
    minimoEstoque: produto.minimoEstoque != null ? produto.minimoEstoque.toString() : null,
    categoriaId: produto.categoriaId ?? null,
    categoriaNome: produto.categoria?.nome ?? null,
    classificacao: produto.categoria?.classificacao ?? null,
    // Comportamento é da categoria, mesmo que ela esteja inativa (situação é do produto).
    categoria: produto.categoria
      ? { id: produto.categoria.id, nome: produto.categoria.nome, usoSanitario: produto.categoria.usoSanitario, usoNutricional: produto.categoria.usoNutricional, usoAgricola: produto.categoria.usoAgricola }
      : null,
    ativo: produto.ativo,
    centroCustoIds: produto.centrosCusto.map(({ centroCustoId }) => centroCustoId),
    centrosCusto: produto.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome, ativo: centroCusto.ativo })),
    fornecedores: produto.fornecedores.map(({ fornecedor }) => ({ id: fornecedor.id, nome: fornecedor.nome, ativo: fornecedor.ativo })),
  };
}

async function validarFornecedores(db: DbFinanceiro, fornecedorIds: number[], permitidosInativos: Set<number>) {
  if (!fornecedorIds.length) return;
  const fornecedores = await db.parceiro.findMany({ where: { id: { in: fornecedorIds } }, include: { papeis: true } });
  const validos = new Set(fornecedores.filter((p) =>
    (p.ativo || permitidosInativos.has(p.id)) && papeisDoParceiro(p).includes("FORNECEDOR")
  ).map((p) => p.id));
  if (fornecedorIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente parceiros ativos com papel de fornecedor", "fornecedorIds");
  }
}

async function validarCentrosCusto(db: DbFinanceiro, centroCustoIds: number[], permitidosInativos: Set<number>) {
  if (!centroCustoIds.length) return;
  const centros = await db.centroCusto.findMany({ where: { id: { in: centroCustoIds } } });
  const validos = new Set(centros.filter((c) => c.ativo || permitidosInativos.has(c.id)).map((c) => c.id));
  if (centroCustoIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente centros de custo ativos", "centroCustoIds");
  }
}

function separarRelacoes<T extends { fornecedorIds?: number[]; centroCustoIds?: number[] }>(input: T) {
  const { fornecedorIds, centroCustoIds, ...produto } = input;
  return { fornecedorIds, centroCustoIds, produto };
}

const USO_CAMPO = { sanitario: "usoSanitario", nutricional: "usoNutricional", agricola: "usoAgricola" } as const;

export async function listarProdutos(f?: { uso?: "sanitario" | "nutricional" | "agricola"; q?: string; ativo?: boolean; incluirInativos?: boolean }) {
  const where: Prisma.ProdutoWhereInput = {};
  if (f?.uso) where.categoria = { [USO_CAMPO[f.uso]]: true };
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  if (f?.ativo != null) where.ativo = f.ativo;
  else if (!f?.incluirInativos) where.ativo = true;
  return (await prisma.produto.findMany({ where, orderBy: [{ ativo: "desc" }, { nome: "asc" }], include: includeProduto })).map(produtoDTO);
}

export async function listarProdutosCadastro() {
  return (await prisma.produto.findMany({ include: includeProduto, orderBy: [{ ativo: "desc" }, { nome: "asc" }] })).map(produtoDTO);
}

export async function criarProduto(input: ProdutoInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { fornecedorIds = [], centroCustoIds = [], produto } = separarRelacoes(input);
      if (produto.estocavel && produto.categoriaId == null) {
        throw new FinanceiroError("VALIDACAO", "Produto estocável precisa de uma categoria", "categoriaId");
      }
      await validarFornecedores(tx, fornecedorIds, new Set());
      await validarCentrosCusto(tx, centroCustoIds, new Set());
      const criado = await tx.produto.create({
        data: {
          ...produto,
          fornecedores: { create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          centrosCusto: { create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
        },
        include: includeProduto,
      });
      const dto = produtoDTO(criado);
      await auditar(tx, { entidade: "Produto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: dto });
      return dto;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

export async function atualizarProduto(id: number, input: ProdutoPatchInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.produto.findUnique({ where: { id }, include: includeProduto });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Produto não encontrado");
      const { fornecedorIds, centroCustoIds, produto } = separarRelacoes(input);

      const estocavel = produto.estocavel ?? anterior.estocavel;
      const categoriaId = produto.categoriaId !== undefined ? produto.categoriaId : anterior.categoriaId;
      if (estocavel && categoriaId == null) {
        throw new FinanceiroError("VALIDACAO", "Produto estocável precisa de uma categoria", "categoriaId");
      }

      // Trocar a unidade muda a interpretação de tudo que já foi movimentado
      // (estoque) ou planejado (dieta) na unidade antiga — bloqueia se houver
      // algum registro para esse produto.
      if (produto.unidade !== undefined && produto.unidade !== anterior.unidade) {
        const [movimentos, itensDieta] = await Promise.all([
          tx.movimentoEstoque.count({ where: { produtoId: id } }),
          tx.dietaItem.count({ where: { produtoId: id } }),
        ]);
        if (movimentos > 0 || itensDieta > 0) {
          throw new FinanceiroError("VALIDACAO", "Não é possível trocar a unidade de um produto com movimentos de estoque ou dietas registradas", "unidade");
        }
      }

      if (fornecedorIds !== undefined) {
        await validarFornecedores(tx, fornecedorIds, new Set(anterior.fornecedores.map((v) => v.fornecedorId)));
      }
      if (centroCustoIds !== undefined) {
        await validarCentrosCusto(tx, centroCustoIds, new Set(anterior.centrosCusto.map((v) => v.centroCustoId)));
      }

      const atualizado = await tx.produto.update({
        where: { id },
        data: {
          ...produto,
          ...(fornecedorIds === undefined ? {} : {
            fornecedores: { deleteMany: {}, create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          }),
          ...(centroCustoIds === undefined ? {} : {
            centrosCusto: { deleteMany: {}, create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
          }),
        },
        include: includeProduto,
      });
      const antes = produtoDTO(anterior);
      const depois = produtoDTO(atualizado);
      await auditar(tx, { entidade: "Produto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois });
      return depois;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

// ── Sugestão de preço na compra ─────────────────────────────────────────────
// O cadastro não guarda preço: a sugestão vem do último item comprado do
// produto em operação confirmada, preferindo o fornecedor informado.
export interface UltimoPrecoDTO {
  valorUnitario: string;
  data: string;
  parceiro: { id: number; nome: string } | null;
}

const TIPOS_COMPRA = ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO"] as const;

export async function obterUltimoPreco(produtoId: number, f: { parceiroId?: number | null; propriedadeId?: number | null } = {}): Promise<UltimoPrecoDTO | null> {
  const buscar = (parceiroId?: number) => prisma.itemOperacao.findFirst({
    where: {
      produtoId,
      operacao: {
        tipo: { in: [...TIPOS_COMPRA] },
        status: "CONFIRMADA",
        ...(f.propriedadeId != null ? { propriedadeId: f.propriedadeId } : {}),
        ...(parceiroId != null ? { parceiroId } : {}),
      },
    },
    orderBy: [{ operacao: { data: "desc" } }, { id: "desc" }],
    select: { valorUnitario: true, operacao: { select: { data: true, parceiro: { select: { id: true, nome: true } } } } },
  });
  const item = (f.parceiroId != null ? await buscar(f.parceiroId) : null) ?? await buscar();
  if (!item) return null;
  return {
    valorUnitario: item.valorUnitario.toString(),
    data: item.operacao.data.toISOString().slice(0, 10),
    parceiro: item.operacao.parceiro ? { id: item.operacao.parceiro.id, nome: item.operacao.parceiro.nome } : null,
  };
}
