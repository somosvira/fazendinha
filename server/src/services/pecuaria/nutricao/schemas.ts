import { z } from "zod";

export const paginaNutricaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
});
export const listaNutricaoSchema = paginaNutricaoSchema.extend({ loteId: z.string().uuid().optional() });
export type PaginaNutricao = z.infer<typeof paginaNutricaoSchema>;

export const listaFechamentosSchema = listaNutricaoSchema.extend({ status: z.enum(["CONFIRMADO", "ESTORNADO"]).optional() });
