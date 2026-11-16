import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";
import { usoQuerySchema } from "./produtos.schemas.js";

export const PRODUTO_OU_CATALOGO = "Informe o produto da fazenda ou o item do catálogo, não os dois";
export const PRODUTO_OBRIGATORIO = "Selecione um produto";

export const consultaCatalogoProdutosSchema = z.object({
  busca: z.string().trim().max(160).default(""),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export type ConsultaCatalogoProdutos = z.infer<typeof consultaCatalogoProdutosSchema>;

export const buscaProdutosSchema = z.object({
  q: z.string().trim().max(160).default(""),
  uso: usoQuerySchema.optional(),
  limite: z.coerce.number().int().min(1).max(50).default(10),
}).strict();
export type BuscaProdutos = z.infer<typeof buscaProdutosSchema>;

/**
 * Regra comum dos fluxos que aceitam `produtoCatalogoId` como alternativa a `produtoId`:
 * nunca os dois; com `obrigatorio`, exatamente um. `categoriaId` de adoção, quando o fluxo
 * o aceita separado da linha, só faz sentido com `produtoCatalogoId`.
 */
export function refinarProdutoOuCatalogo(opcoes: { obrigatorio: boolean; campoCategoriaAdocao?: string }) {
  return (v: { produtoId?: string | null; produtoCatalogoId?: string | null } & Record<string, unknown>, ctx: z.RefinementCtx) => {
    const temProduto = v.produtoId != null, temCatalogo = v.produtoCatalogoId != null;
    if (temProduto && temCatalogo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["produtoCatalogoId"], message: PRODUTO_OU_CATALOGO });
    else if (opcoes.obrigatorio && !temProduto && !temCatalogo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["produtoId"], message: PRODUTO_OBRIGATORIO });
    const campo = opcoes.campoCategoriaAdocao;
    if (campo && v[campo] != null && !temCatalogo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: "A categoria do produto só é informada ao usar um item do catálogo" });
  };
}

export const resolucaoProdutoSchema = z.object({
  produtoId: z.string().uuid().optional(),
  produtoCatalogoId: z.string().uuid().optional(),
  unidade: z.nativeEnum(UnidadeMedida).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
}).superRefine(refinarProdutoOuCatalogo({ obrigatorio: true }));
export type ResolucaoProduto = z.infer<typeof resolucaoProdutoSchema>;
