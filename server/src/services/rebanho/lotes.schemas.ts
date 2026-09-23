import { z } from "zod";

// Local de armazenamento (galpão, depósito, etc.) de lotes de produto.
export const criarLocalSchema = z.object({ nome: z.string().min(1).max(80), ativo: z.boolean().optional() });
export type CriarLocalSchemaInput = z.infer<typeof criarLocalSchema>;

// Lote de produto (código + validade + local).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
export const criarLoteSchema = z.object({
  produtoId: z.number().int().positive(),
  codigo: z.string().min(1, "informe o código do lote").max(60),
  validade: isoDate.nullable().optional(),
  localId: z.number().int().positive().nullable().optional(),
  quantidade: z.number().min(0).max(9_999_999).nullable().optional(),
});
export type CriarLoteSchemaInput = z.infer<typeof criarLoteSchema>;
