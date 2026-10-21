import { z } from "zod";
export const paginaCadastroProtocoloSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(10).default(10),
}).strict();
export const consultaCadastroProtocoloSchema = paginaCadastroProtocoloSchema.extend({
  tipo: z.enum(["SANITARIO", "REPRODUTIVO"]),
  busca: z.string().trim().max(160).optional(),
  situacao: z.enum(["TODAS", "RASCUNHO", "PUBLICADA", "INATIVA"]).default("TODAS"),
});
export const consultaAcoesCadastroSchema = paginaCadastroProtocoloSchema.extend({ revisao: z.string().datetime().optional() });
export type ConsultaCadastroProtocolo = z.infer<typeof consultaCadastroProtocoloSchema>;
