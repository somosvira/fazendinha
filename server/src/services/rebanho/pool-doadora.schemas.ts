import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
export const criarGrupoPoolSchema = z.object({ nome: z.string().trim().min(1).max(120), doadoraIds: z.array(z.number().int().positive()).min(1) });
export const atualizarGrupoPoolSchema = z.object({ nome: z.string().trim().min(1).max(120).optional(), ativo: z.boolean().optional() });
export const salvarItensPoolSchema = z.object({ doadoraIds: z.array(z.number().int().positive()).min(1) });
export const aplicarPoolSchema = z.object({ data: isoDate, tecnico: z.string().trim().max(120).optional() });
export type CriarGrupoPoolInput = z.infer<typeof criarGrupoPoolSchema>;
export type AplicarPoolInput = z.infer<typeof aplicarPoolSchema>;
