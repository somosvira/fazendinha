import { z } from "zod";
import { dataLeiteSchema } from "./schemas.js";

export const consultaCustosLeiteSchema = z.object({
  inicio: dataLeiteSchema,
  fim: dataLeiteSchema,
  animalId: z.string().uuid().optional(),
  posicaoId: z.string().uuid().optional(),
  natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"]).optional(),
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
}).strict().refine(v => v.inicio <= v.fim &&
  (Date.parse(v.fim) - Date.parse(v.inicio)) / 86400000 < 366,
"Consulte um período de até 366 dias, com início anterior ao fim");

export type ConsultaCustosLeite = z.infer<typeof consultaCustosLeiteSchema>;
