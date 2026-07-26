import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const registrarAptidaoSchema = z.object({
  data: isoDate,
  apta: z.boolean(),
  motivo: z.string().trim().min(1).max(200).optional(),
});

export const aplicarAptidaoAutomaticaSchema = z.object({
  data: isoDate.optional(),
});

export type RegistrarAptidaoInput = z.infer<typeof registrarAptidaoSchema>;
