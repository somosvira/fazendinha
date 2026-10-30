import { z } from "zod";
import { dataLeiteSchema } from "./schemas.js";
export const consultarHistoricoProdutivoSchema = z.object({
  inicio: dataLeiteSchema.optional(), fim: dataLeiteSchema.optional(),
  pagina: z.coerce.number().int().positive().default(1), tamanho: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((v, ctx) => {
  if (v.inicio && v.fim && (v.inicio > v.fim || (new Date(v.fim).getTime() - new Date(v.inicio).getTime()) / 86400000 > 365))
    ctx.addIssue({ code: "custom", path: ["fim"], message: "Escolha um período de até 366 dias, com fim posterior ao início" });
});
export type ConsultaHistoricoProdutivo = z.infer<typeof consultarHistoricoProdutivoSchema>;
export const consultarControlesColetivosSchema = z.object({
  inicio: dataLeiteSchema, fim: dataLeiteSchema,
  pagina: z.coerce.number().int().positive().max(1000000).default(1),
  tamanho: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v => v.inicio <= v.fim && Date.parse(v.fim) - Date.parse(v.inicio) <= 365 * 86400000, {
  path: ["fim"], message: "Escolha um período de até 366 dias, com fim posterior ao início",
});
export type ConsultaControlesColetivos = z.infer<typeof consultarControlesColetivosSchema>;
