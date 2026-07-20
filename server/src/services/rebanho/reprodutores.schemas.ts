import { z } from "zod";

export const criarCentralSchema = z.object({
  nome: z.string().min(1, "informe o nome da central").max(80),
  ativo: z.boolean().optional(),
});
export type CriarCentralInput = z.infer<typeof criarCentralSchema>;

const pta = z.number().min(-9999).max(99999).nullable().optional();

export const criarReprodutorSchema = z.object({
  nome: z.string().min(1, "informe o nome do reprodutor").max(120),
  codigo: z.string().max(60).nullable().optional(),
  racaId: z.number().int().positive().nullable().optional(),
  centralSemenId: z.number().int().positive().nullable().optional(),
  ptaLeite: pta,
  ptaGordura: pta,
  ptaProteina: pta,
  tpi: z.number().int().min(-9999).max(9999).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type CriarReprodutorInput = z.infer<typeof criarReprodutorSchema>;

export const atualizarReprodutorSchema = criarReprodutorSchema.partial();
export type AtualizarReprodutorInput = z.infer<typeof atualizarReprodutorSchema>;
