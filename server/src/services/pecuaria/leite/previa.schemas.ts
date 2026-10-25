import { z } from "zod";
import { Prisma } from "@prisma/client";
import { dataLeiteSchema } from "./schemas.js";
export const previaHistoricaLeiteSchema = z
  .object({
    inicio: dataLeiteSchema,
    fim: dataLeiteSchema,
    unidade: z.literal("L"),
    referenciaUnidade: z.string().trim().min(5).max(500),
    origemArquivo: z.string().trim().min(3).max(300),
    linhas: z
      .array(
        z
          .object({
            origemId: z.string().trim().min(1).max(150),
            brinco: z.string().trim().min(1).max(150),
            data: dataLeiteSchema,
            ordenha: z.string().trim().min(1).max(60),
            estado: z.enum(["MEDIDO", "NAO_ORDENHADO", "PENDENTE"]),
            litros: z
              .number()
              .finite()
              .nonnegative()
              .max(9999999.999)
              .nullable(),
            motivo: z.string().trim().max(500).nullish(),
            responsavelFonte: z.string().trim().max(160).nullish(),
          })
          .strict(),
      )
      .min(1)
      .max(20000),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.inicio > v.fim ||
      Date.parse(v.fim) - Date.parse(v.inicio) >= 366 * 86400000
    )
      c.addIssue({
        code: "custom",
        path: ["fim"],
        message: "Informe um lote de até 366 dias",
      });
    v.linhas.forEach((l, i) => {
      if (l.data < v.inicio || l.data > v.fim)
        c.addIssue({
          code: "custom",
          path: ["linhas", i, "data"],
          message: "Linha fora do período declarado",
        });
      if (
        l.estado === "MEDIDO" &&
        (l.litros === null || new Prisma.Decimal(l.litros).decimalPlaces() > 3)
      )
        c.addIssue({
          code: "custom",
          path: ["linhas", i, "litros"],
          message:
            "Medição exige litros explícitos com até três casas decimais",
        });
      if (l.estado !== "MEDIDO" && l.litros !== null)
        c.addIssue({
          code: "custom",
          path: ["linhas", i, "litros"],
          message: "Ausência de medição não admite litros presumidos",
        });
      if (l.estado === "NAO_ORDENHADO" && (l.motivo?.length ?? 0) < 5)
        c.addIssue({
          code: "custom",
          path: ["linhas", i, "motivo"],
          message: "Informe o motivo de não ordenha",
        });
    });
  });
export type PreviaHistoricaLeiteInput = z.infer<
  typeof previaHistoricaLeiteSchema
>;
