import { z } from "zod";
import { executarExameEtapaSchema } from "../sanidade/execucao-etapas.schemas.js";
import { tentativaSchema, avaliacaoSchema, dataOuHorario } from "../reproducao/schemas.js";

const comuns = {
  tarefaId: z.string().uuid(),
  realizadaEm: dataOuHorario.optional(),
  desvio: z.object({ motivo: z.string().trim().min(5).max(500) }).strict().optional(),
  cienciaRecalendarioLegado: z.boolean().optional(),
};
export const exameProtocoloSchema = executarExameEtapaSchema.extend({ ...comuns, observacao: z.string().trim().max(1000).nullish(), formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
export const tentativaProtocoloSchema = tentativaSchema.omit({ chave: true, tipo: true }).extend({
  ...comuns, tipo: z.literal("TENTATIVA"), tipoTentativa: tentativaSchema.shape.tipo,
}).strict();
// Não realização pertence a EventoTarefaProtocolo. O exame anterior continua legível.
export const avaliacaoProtocoloBase = avaliacaoSchema.omit({ chave: true }).extend({
  ...comuns, tipo: z.literal("AVALIACAO"),
  reavaliacao: z.boolean().optional(),
  resultado: z.enum(["POSITIVO", "NEGATIVO", "RECONFIRMACAO", "SEXAGEM", "INCONCLUSIVO", "NAO_AVALIADO"]),
}).strict();
export function validarAvaliacaoRealizada(item: z.infer<typeof avaliacaoProtocoloBase>, ctx: z.RefinementCtx) {
  if (item.resultado === "NAO_AVALIADO" && (!item.realizadoSemDG || !item.avaliacaoContextual))
    ctx.addIssue({ code:"custom", path:["resultado"], message:"Uma avaliação sem DG exige itens contextuais efetivamente realizados" });
}
export const avaliacaoProtocoloSchema = avaliacaoProtocoloBase.superRefine(validarAvaliacaoRealizada);
export const itemExecucaoClinicaSchema = z.discriminatedUnion("tipo", [
  exameProtocoloSchema, tentativaProtocoloSchema, avaliacaoProtocoloBase,
]).superRefine((item,ctx)=>{ if(item.tipo === "AVALIACAO") validarAvaliacaoRealizada(item,ctx); });
export type ItemExecucaoClinica = z.infer<typeof itemExecucaoClinicaSchema>;
