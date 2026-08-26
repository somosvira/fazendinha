import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "hora deve ser HH:MM");
const tipoDiaPontoSchema = z.enum(["UTIL", "DOMINGO", "FERIADO", "FOLGA", "FALTA"]);

export const upsertRegistroSchema = z.object({
  funcionarioId: z.coerce.number().int().positive(),
  data: isoDate,
  entrada: hhmm.nullish(),
  saida: hhmm.nullish(),
  intervaloMin: z.number().int().nonnegative().default(60),
  tipoDia: tipoDiaPontoSchema.default("UTIL"),
  observacao: z.string().max(400).nullish(),
});

export type UpsertRegistroSchemaInput = z.infer<typeof upsertRegistroSchema>;
