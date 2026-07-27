import { z } from "zod";

export const criarLoteSchema = z.object({
  tipoSemenId: z.number().int().positive().nullable().optional(),
  lote: z.string().nullable().optional(),
  localizacao: z.string().nullable().optional(),
  dosesDisponiveis: z.number().int().min(0),
});
export type CriarLoteInput = z.infer<typeof criarLoteSchema>;

export const ajustarDosesSchema = z.object({
  delta: z.number().int(),
});
export type AjustarDosesInput = z.infer<typeof ajustarDosesSchema>;

export const criarTipoSemenSchema = z.object({
  sigla: z.string().min(1).max(40),
  nome: z.string().min(1).max(120),
});
export type CriarTipoSemenInput = z.infer<typeof criarTipoSemenSchema>;
