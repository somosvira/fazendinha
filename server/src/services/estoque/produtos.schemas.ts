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
  usoGenetico: z.boolean().optional(),
  usoSanitario: z.boolean().optional(),
  usoNutricional: z.boolean().optional(),
  rastrearPartidas: z.boolean().optional(),
  minimoEstoque: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "estoque mínimo muito alto").nullable().optional(),
  // Categoria define a classificação financeira; os usos pertencem ao Produto.
  categoriaId: z.string({ required_error: CATEGORIA_OBRIGATORIA, invalid_type_error: CATEGORIA_OBRIGATORIA }).uuid(CATEGORIA_OBRIGATORIA),
  centroCustoIds: idsSchema("Centros de custo").default([]),
  fornecedorIds: idsSchema("Fornecedores").default([]),
  perfilSanitario: z.object({ carenciaLeiteHoras: z.number({ invalid_type_error: "Informe um número inteiro de horas, igual ou maior que zero." }).int("Informe um número inteiro de horas.").nonnegative("A carência não pode ser negativa.").nullable(), carenciaCarneHoras: z.number({ invalid_type_error: "Informe um número inteiro de horas, igual ou maior que zero." }).int("Informe um número inteiro de horas.").nonnegative("A carência não pode ser negativa.").nullable(), viaPadrao: z.string().trim().max(80, "Informe uma via com até 80 caracteres.").nullish(), referenciaTecnica: z.string().trim().max(300, "Informe uma referência com até 300 caracteres.").nullish() }).optional(),
  perfilNutricional: z.object({ materiaSecaPercentual: z.number({ invalid_type_error: "Informe a matéria seca entre 0% e 100%." }).finite("Informe a matéria seca entre 0% e 100%.").min(0, "Informe a matéria seca entre 0% e 100%.").max(100, "Informe a matéria seca entre 0% e 100%.").multipleOf(0.01, "Use até duas casas decimais na matéria seca.").nullable() }).optional(),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

export const patchProdutoSchema = produtoSchema.partial().extend({ ativo: z.boolean().optional() });
export type ProdutoPatchInput = z.infer<typeof patchProdutoSchema>;

// Filtro de produtos por seus tipos de uso — usado por
// /estoque/produtos para validar o query param `uso`.
export const usoQuerySchema = z.enum(["genetico", "sanitario", "nutricional"]);
export const produtosQuerySchema = z.object({
  uso: usoQuerySchema.optional(),
  q: z.string().optional(),
  ativo: z.enum(["true", "false"]).optional(),
});
export type ProdutosQuery = z.infer<typeof produtosQuerySchema>;
