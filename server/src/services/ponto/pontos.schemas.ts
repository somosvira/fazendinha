import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "hora deve ser HH:MM");
const tipoDia = z.enum(["UTIL", "DOMINGO", "FERIADO", "FOLGA", "FALTA"]);
const mes = z.string().regex(/^\d{4}-\d{2}$/, "mês deve ser YYYY-MM");

export const listRegistrosSchema = z.object({
  funcionarioId: z.coerce.number().int().positive(),
  mes,
});

export const upsertRegistroSchema = z.object({
  funcionarioId: z.number().int().positive(),
  data: isoDate,
  entrada: hhmm.nullish(),
  saida: hhmm.nullish(),
  intervaloMin: z.number().int().nonnegative().default(60),
  tipoDia: tipoDia.default("UTIL"),
  observacao: z.string().max(400).nullish(),
});

export const folhaMesSchema = z.object({ mes });

export type ListRegistrosFiltros = z.infer<typeof listRegistrosSchema>;
export type UpsertRegistroSchemaInput = z.infer<typeof upsertRegistroSchema>;
