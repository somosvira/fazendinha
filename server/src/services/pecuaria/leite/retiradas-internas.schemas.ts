import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
const litros = z.number().finite().positive().max(9999999.999).refine(v => new Prisma.Decimal(v).decimalPlaces() <= 3, "Use até três casas decimais em litros");
export const retiradaInternaLeiteSchema = z.object({
  chave: z.string().uuid(), propriedadeId: propriedadeLeiteSchema.optional(), entradaId: z.string().uuid(), data: dataLeiteSchema,
  destino: z.enum(["CASA", "FUNCIONARIOS"]), responsavel: z.string().trim().min(2).max(200),
  quantidadeLitros: litros, quantidadeDisponivelEsperadaLitros: litros, motivo: z.string().trim().min(5).max(1000),
}).strict().refine(v => v.quantidadeLitros <= v.quantidadeDisponivelEsperadaLitros, "A retirada supera o saldo informado");
export const estornoRetiradaInternaLeiteSchema = z.object({ chave: z.string().uuid(), propriedadeId: propriedadeLeiteSchema.optional(), versaoEsperada: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000) }).strict();
export const consultaRetiradasInternasLeiteSchema = z.object({
  de: dataLeiteSchema.optional(), ate: dataLeiteSchema.optional(), propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(), pagina: z.coerce.number().int().min(1).max(100000).default(1),
}).strict().refine(v => !v.de || !v.ate || v.de <= v.ate, "Período invertido");
export type RetiradaInternaLeiteInput = z.infer<typeof retiradaInternaLeiteSchema>;
export type EstornoRetiradaInternaLeiteInput = z.infer<typeof estornoRetiradaInternaLeiteSchema>;
