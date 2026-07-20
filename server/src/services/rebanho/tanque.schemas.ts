import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const criarTanqueSchema = z.object({
  nome: z.string().min(1, "informe o nome do tanque").max(80),
  capacidadeLitros: z.number().int().min(0).max(1_000_000).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type CriarTanqueInput = z.infer<typeof criarTanqueSchema>;

export const registrarAnaliseTanqueSchema = z.object({
  data: isoDate,
  ccs: z.number().int().min(0).max(99_999).nullable().optional(),
  cbt: z.number().int().min(0).max(99_999).nullable().optional(),
  gordura: z.number().min(0).max(99).nullable().optional(),
  proteina: z.number().min(0).max(99).nullable().optional(),
  temperatura: z.number().min(-10).max(50).nullable().optional(),
  observacao: z.string().max(200).nullable().optional(),
});
export type RegistrarAnaliseTanqueInput = z.infer<typeof registrarAnaliseTanqueSchema>;
