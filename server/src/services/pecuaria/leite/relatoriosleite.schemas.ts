import { z } from "zod";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
const periodo = { inicio: dataLeiteSchema, fim: dataLeiteSchema };
export const emitirRelatorioLeiteSchema = z.object({
  chave: z.string().uuid(), propriedadeId: propriedadeLeiteSchema.optional(), ...periodo,
  animalId: z.string().uuid().optional(), posicaoId: z.string().uuid().optional(), incluirValores: z.boolean().default(false),
}).strict().refine(v => v.inicio <= v.fim && Date.parse(v.fim) - Date.parse(v.inicio) < 366 * 86400000, "Informe um período de até 366 dias");
export const listarRelatoriosLeiteSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
}).strict();
export type EmitirRelatorioLeiteInput = z.infer<typeof emitirRelatorioLeiteSchema>;
