import { z } from "zod";

// Limites compatíveis com Produto.custoUnitario / minimoEstoque (Decimal(12,2))
const MAX_PRODUTO_VALOR = 9_999_999_999.99;

const tipoProdutoSchema = z.enum(["MEDICAMENTO", "RACAO", "INSUMO", "MINERAL", "OUTRO"]);
const subtipoPlantioSchema = z.enum(["FERTILIZANTE", "DEFENSIVO", "HERBICIDA", "CORRETIVO", "BIOLOGICO"]);

const idsSchema = (campo: string) =>
  z.array(z.number().int().positive()).max(200)
    .refine((ids) => new Set(ids).size === ids.length, `${campo} repetidos`);

export const produtoSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  tipo: tipoProdutoSchema.default("INSUMO"),
  subtipoPlantio: subtipoPlantioSchema.nullable().optional(),
  unidade: z.string().trim().min(1).max(12).default("un"),
  custoUnitario: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "custo muito alto").nullable().optional(),
  carencia: z.number().int().nonnegative().max(9999, "carência muito alta").nullable().optional(),
  percentualMS: z.number().min(0).max(100).nullable().optional(),
  estocavel: z.boolean().default(true),
  minimoEstoque: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "estoque mínimo muito alto").nullable().optional(),
  categoriaId: z.number().int().positive().nullable().optional(),
  centroCustoIds: idsSchema("Centros de custo").default([]),
  fornecedorIds: idsSchema("Fornecedores").default([]),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

export const patchProdutoSchema = produtoSchema.partial().extend({ ativo: z.boolean().optional() });
export type ProdutoPatchInput = z.infer<typeof patchProdutoSchema>;
