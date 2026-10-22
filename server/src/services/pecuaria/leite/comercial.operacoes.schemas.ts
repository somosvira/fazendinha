import { z } from "zod";
import { dataLeiteSchema } from "./schemas.js";
import { operacaoSchema } from "../../financeiro/schemas.js";
const uuid = z.string().uuid();
const texto = z.string().trim().min(5).max(500);
const litros = z
  .number()
  .finite()
  .nonnegative()
  .max(999999999.999)
  .multipleOf(0.001);
export const abrirOperacaoLeiteSchema = z
  .object({
    chave: uuid,
    parceiroId: uuid,
    inicio: dataLeiteSchema,
    fim: dataLeiteSchema,
    referencia: texto,
  })
  .strict()
  .refine((v) => v.inicio <= v.fim, {
    message: "O início não pode superar o fim",
    path: ["fim"],
  });
export const retirarOperacaoLeiteSchema = z
  .object({
    chave: uuid,
    versaoEsperada: z.number().int().positive(),
    produtoId: uuid,
    data: dataLeiteSchema,
    quantidadeLitros: litros.refine((v) => v > 0, "Informe litros positivos"),
    referencia: texto,
    pontoColeta: z.string().trim().min(1).max(200).nullable().optional(),
    horarioColeta: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
  })
  .strict();
const fechamentoBase = z
  .object({
    chave: uuid,
    versaoEsperada: z.number().int().positive(),
    data: dataLeiteSchema,
    precoUnitario: z
      .number()
      .finite()
      .positive()
      .max(9999999999.9999)
      .multipleOf(0.0001),
    ajuste: z
      .number()
      .finite()
      .min(-999999999999.99)
      .max(999999999999.99)
      .multipleOf(0.01)
      .default(0),
    motivoAjuste: texto.nullable().optional(),
    motivo: texto,
    amostras: z.array(z.object({ amostraId: uuid, versaoEsperada: z.number().int().positive() }).strict()).max(100).default([]),
    categoriaId: uuid.optional(),
    centroCustoId: uuid.optional(),
    financeiro: operacaoSchema.innerType().shape.financeiro,
    retiradas: z
      .array(
        z
          .object({
            retiradaId: uuid,
            quantidadeReconhecida: litros,
            motivoDiferenca: texto.nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();
export const previaFechamentoOperacaoLeiteSchema = fechamentoBase.pick({
  versaoEsperada: true,
  precoUnitario: true,
  ajuste: true,
  retiradas: true,
});
export const fecharOperacaoLeiteSchema = fechamentoBase
  .superRefine((v, c) => {
    if (new Set(v.amostras.map(a => a.amostraId)).size !== v.amostras.length) c.addIssue({ code: "custom", path: ["amostras"], message: "Informe cada amostra uma única vez" });
    if (
      new Set(v.retiradas.map((r) => r.retiradaId)).size !== v.retiradas.length
    )
      c.addIssue({
        code: "custom",
        path: ["retiradas"],
        message: "Informe cada retirada uma única vez",
      });
    if (v.ajuste !== 0 && !v.motivoAjuste)
      c.addIssue({
        code: "custom",
        path: ["motivoAjuste"],
        message: "Justifique o ajuste monetário, separado do volume físico",
      });
  })
  .transform((v) => ({
    ...v,
    amostras: [...v.amostras].sort((a, b) => a.amostraId.localeCompare(b.amostraId)),
    retiradas: [...v.retiradas].sort((a, b) =>
      a.retiradaId.localeCompare(b.retiradaId),
    ),
  }));
export type AbrirOperacaoLeite = z.infer<typeof abrirOperacaoLeiteSchema>;
export type RetirarOperacaoLeite = z.infer<typeof retirarOperacaoLeiteSchema>;
export type FecharOperacaoLeite = z.input<typeof fecharOperacaoLeiteSchema>;
