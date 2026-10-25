import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
export const registrarConferenciaSaldoLeiteSchema = z.object({
  chave: z.string().uuid(), propriedadeId: propriedadeLeiteSchema.optional(), produtoId: z.string().uuid(), data: dataLeiteSchema,
  litrosObservados: z.number().finite().nonnegative().max(9999999.999).refine(v => new Prisma.Decimal(v).decimalPlaces() <= 3, "Use até três casas decimais"),
  referencia: z.string().trim().min(3).max(500), responsavel: z.string().trim().min(2).max(160),
  versaoEsperada: z.number().int().nonnegative(), motivoCorrecao: z.string().trim().min(5).max(1000).optional(),
}).strict().refine(v => v.versaoEsperada === 0 || !!v.motivoCorrecao, "Explique a correção da conferência física");
export const consultarConferenciasSaldoLeiteSchema = z.object({
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(), produtoId: z.string().uuid().optional(), data: dataLeiteSchema.optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export type RegistrarConferenciaSaldoLeiteInput = z.infer<typeof registrarConferenciaSaldoLeiteSchema>;
