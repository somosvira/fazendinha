import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";

// Limite compatível com Produto.minimoEstoque (Decimal(12,2))
const MAX_PRODUTO_VALOR = 9_999_999_999.99;

export const CATEGORIA_OBRIGATORIA = "Produto precisa de uma categoria";

const idsSchema = (campo: string) =>
  z.array(z.string().uuid()).max(200)
    .refine((ids) => new Set(ids).size === ids.length, `${campo} repetidos`);

export const produtoSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  unidade: z.nativeEnum(UnidadeMedida).default("UN"),
  minimoEstoque: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "estoque mínimo muito alto").nullable().optional(),
  // Categoria é obrigatória: é ela que define o uso do produto (agrícola) e a
  // classificação herdada pelo item da operação. Se o produto tem estoque não
  // é do cadastro — quem decide é a operação.
  categoriaId: z.string({ required_error: CATEGORIA_OBRIGATORIA, invalid_type_error: CATEGORIA_OBRIGATORIA }).uuid(CATEGORIA_OBRIGATORIA),
  centroCustoIds: idsSchema("Centros de custo").default([]),
  fornecedorIds: idsSchema("Fornecedores").default([]),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

export const patchProdutoSchema = produtoSchema.partial().extend({ ativo: z.boolean().optional() });
export type ProdutoPatchInput = z.infer<typeof patchProdutoSchema>;

// Filtro de produtos por uso (marcações da categoria) — usado por
// /estoque/produtos para validar o query param `uso`.
export const usoQuerySchema = z.enum(["agricola", "genetico", "sanitario", "nutricional"]);
export const produtosQuerySchema = z.object({
  uso: usoQuerySchema.optional(),
  q: z.string().optional(),
  ativo: z.enum(["true", "false"]).optional(),
});
export type ProdutosQuery = z.infer<typeof produtosQuerySchema>;
