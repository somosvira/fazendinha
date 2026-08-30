import { z } from "zod";

const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");
const litrosPorOrdenha = z.number().positive().max(9999.99, "valor deve ser menor que 10.000 L");

export const controleSchema = z.object({
  data: dataNaoFutura, peso1: litrosPorOrdenha.optional(), peso2: litrosPorOrdenha.optional(), peso3: litrosPorOrdenha.optional(),
  pesoTotal: litrosPorOrdenha.optional(), observacao: z.string().max(200).optional(),
}).refine((v) => (v.peso1 ?? v.peso2 ?? v.peso3 ?? v.pesoTotal) != null, "informe ao menos um peso");
export type ControleInput = z.infer<typeof controleSchema>;
