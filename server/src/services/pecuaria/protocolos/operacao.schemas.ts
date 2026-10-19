import { z } from "zod";
import { dataOuHorario } from "../reproducao/schemas.js";
export const situacaoOperacaoSchema = z.enum(["ATENDIDO", "NAO_ATENDIDO", "SEM_REGISTRO", "ADIADO", "PREVISTO", "REGULARIZACAO_PENDENTE", "DISPENSADO", "RETIRADO", "ENCERRADO", "PENDENTES", "ATRASADAS"]);
export const consultaOperacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(10).default(10),
  busca: z.string().trim().max(160).optional(),
  situacao: situacaoOperacaoSchema.optional(),
  etapaId: z.string().uuid().optional(),
}).strict();
export type ConsultaOperacao = z.infer<typeof consultaOperacaoSchema>;
export type ContextoOperacao = { programacaoId: string; participacaoId?: never } | { participacaoId: string; programacaoId?: never };
export const previaParticipacaoIndividualSchema = z.object({
  tipo: z.enum(["SANITARIO","REPRODUTIVO"]), protocoloId:z.string().uuid(), animalId:z.string().uuid(),
  propriedadeId:z.number().int().positive(), inicioReferencia:dataOuHorario,
  pagina:z.number().int().positive().default(1),porPagina:z.number().int().min(1).max(10).default(10),
}).strict();
export const listaOperacaoSchema = consultaOperacaoSchema.pick({pagina:true,porPagina:true,busca:true}).extend({
  animalId:z.string().uuid().optional(),tipo:z.enum(["SANITARIO","REPRODUTIVO"]).optional(),
});
export type ListaOperacao = z.infer<typeof listaOperacaoSchema>;
export const consultaVersoesOperacaoSchema = consultaOperacaoSchema.pick({pagina:true,porPagina:true,busca:true}).extend({
  tipo:z.enum(["SANITARIO","REPRODUTIVO"]),
});
export type ConsultaVersoesOperacao = z.infer<typeof consultaVersoesOperacaoSchema>;
export const consultaVinculosColetivosOperacaoSchema = listaOperacaoSchema.extend({
  animalId:z.string().uuid(),tipo:z.literal("REPRODUTIVO"),participacaoId:z.string().uuid().optional(),
});
export type ConsultaVinculosColetivosOperacao = z.infer<typeof consultaVinculosColetivosOperacaoSchema>;
export const consultaOrigensFatoOperacaoSchema = consultaOperacaoSchema.pick({pagina:true,porPagina:true}).extend({
  animalId:z.string().uuid(),fatoId:z.string().uuid(),exameId:z.string().uuid().optional(),
});
export type ConsultaOrigensFatoOperacao = z.infer<typeof consultaOrigensFatoOperacaoSchema>;
