import { z } from "zod";
import { Prisma } from "@prisma/client";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";
const base = {
  chave: z.string().uuid(),
  propriedadeId: propriedadeLeiteSchema,
  vigenteDesde: dataLeiteSchema,
  versaoEsperada: z.number().int().nonnegative(),
};
const dia = z.number().int().min(0).max(6);
export const programacaoRetiradaSchema = z
  .discriminatedUnion("tipo", [
    z.object({ ...base, tipo: z.literal("DIARIA") }).strict(),
    z.object({ ...base, tipo: z.literal("SEMANAL"), diaSemana: dia }).strict(),
    z
      .object({
        ...base,
        tipo: z.literal("DIAS_ESCOLHIDOS"),
        diasSemana: z.array(dia).min(1).max(7),
      })
      .strict(),
    z
      .object({
        ...base,
        tipo: z.literal("META_LITROS"),
        produtoId: z.string().uuid(),
        metaLitros: z.number().finite().positive().max(999999999.999),
      })
      .strict(),
  ])
  .superRefine((valor, ctx) => {
    if (
      valor.tipo === "DIAS_ESCOLHIDOS" &&
      new Set(valor.diasSemana).size !== valor.diasSemana.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["diasSemana"],
        message: "Escolha dias da semana distintos",
      });
    if (
      valor.tipo === "META_LITROS" &&
      new Prisma.Decimal(valor.metaLitros).decimalPlaces() > 3
    )
      ctx.addIssue({
        code: "custom",
        path: ["metaLitros"],
        message: "A meta deve ter até três casas decimais",
      });
  });
export const consultarProgramacaoSchema = z.object({ data: dataLeiteSchema });
export type ProgramacaoRetiradaInput = z.infer<
  typeof programacaoRetiradaSchema
>;
