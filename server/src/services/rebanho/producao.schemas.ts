import { z } from "zod";

const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// Fonte real em packages/shared (modo ORDENHA — coberto offline); re-export pra
// quem já importa daqui não precisar mudar.
export { controleSchema, type ControleInput } from "@rionovo/shared";

// producaoLoteSchema (modo TANQUE_LOTE) fica só aqui — fora do escopo da fatia
// offline (a Rio Novo não usa esse modo, ver docs/design/offline/REBANHO_SANIDADE_PRODUCAO_NOTAS.md).
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
