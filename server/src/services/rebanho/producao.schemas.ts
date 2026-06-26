import { z } from "zod";

const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

export const controleSchema = z
  .object({
    data: dataNaoFutura,
    peso1: z.number().positive().optional(),
    peso2: z.number().positive().optional(),
    peso3: z.number().positive().optional(),
    pesoTotal: z.number().positive().optional(),
    observacao: z.string().max(200).optional(),
  })
  .refine((v) => (v.peso1 ?? v.peso2 ?? v.peso3 ?? v.pesoTotal) != null, "informe ao menos um peso");
export type ControleInput = z.infer<typeof controleSchema>;

export const producaoLoteSchema = z.object({
  grupoId: z.number().int().optional(),
  data: dataNaoFutura,
  litros: z.number().positive(),
});
export type ProducaoLoteInput = z.infer<typeof producaoLoteSchema>;

export const configSchema = z.object({
  producaoModo: z.enum(["ORDENHA", "TOTAL_DIARIO", "TANQUE_LOTE"]).optional(),
  precoLeite: z.number().nonnegative().nullable().optional(),
});
export type ConfigInput = z.infer<typeof configSchema>;
