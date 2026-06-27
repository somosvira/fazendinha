import { z } from "zod";

const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// Decimal(6,2) na coluna → cap em 9999.99 evita Postgres 22003 (numeric overflow)
const litrosPorOrdenha = z.number().positive().max(9999.99, "valor deve ser menor que 10.000 L");

export const controleSchema = z
  .object({
    data: dataNaoFutura,
    peso1: litrosPorOrdenha.optional(),
    peso2: litrosPorOrdenha.optional(),
    peso3: litrosPorOrdenha.optional(),
    pesoTotal: litrosPorOrdenha.optional(),
    observacao: z.string().max(200).optional(),
  })
  .refine((v) => (v.peso1 ?? v.peso2 ?? v.peso3 ?? v.pesoTotal) != null, "informe ao menos um peso");
export type ControleInput = z.infer<typeof controleSchema>;

export const producaoLoteSchema = z.object({
  grupoId: z.number().int().optional(),
  data: dataNaoFutura,
  // ProducaoLote.litros é Decimal(10,2): cap em 99_999_999.99
  litros: z.number().positive().max(99_999_999.99, "litros deve ser menor que 100 milhões"),
});
export type ProducaoLoteInput = z.infer<typeof producaoLoteSchema>;

export const configSchema = z.object({
  producaoModo: z.enum(["ORDENHA", "TOTAL_DIARIO", "TANQUE_LOTE"]).optional(),
  precoLeite: z.number().nonnegative().nullable().optional(),
});
export type ConfigInput = z.infer<typeof configSchema>;
