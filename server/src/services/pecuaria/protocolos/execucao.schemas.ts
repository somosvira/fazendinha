import { exameProtocoloSchema,tentativaProtocoloSchema,avaliacaoProtocoloSchema } from "./execucao.clinica.schemas.js";
import { manejoProtocoloSchema,retiradaProtocoloSchema } from "./execucao.manejos.schemas.js";
import { z } from "zod";
import { executarAplicacaoEtapaSchema } from "../sanidade/execucao-etapas.schemas.js";

/** O tipo da ação define o payload. Finalidade sanitária/reprodutiva vem da tarefa. */
export const aplicacaoProtocoloSchema = executarAplicacaoEtapaSchema.extend({
  aplicadaEm: z.string().datetime({ offset: true }).optional(),
  cienciaSanitaria: z.boolean().optional(),
  cienciaRecalendarioLegado: z.boolean().optional(),
}).strict();
export const execucaoProtocoloSchema = z.object({
  versao: z.literal(1), propriedadeId: z.number().int().positive().max(2147483647),
  itens: z.array(z.discriminatedUnion("tipo", [aplicacaoProtocoloSchema,exameProtocoloSchema,tentativaProtocoloSchema,avaliacaoProtocoloSchema,manejoProtocoloSchema,retiradaProtocoloSchema])).min(1).max(100),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.itens.map(i => i.tarefaId)).size !== input.itens.length || new Set(input.itens.map(i => i.animalId)).size !== input.itens.length)
    ctx.addIssue({ code: "custom", path: ["itens"], message: "Selecione tarefas de animais distintos" });
  if (input.itens.some(i => i.propriedadeId !== input.propriedadeId))
    ctx.addIssue({ code: "custom", path: ["itens"], message: "Todos os fatos precisam ocorrer no sítio selecionado" });
});
export const paginaExecucaoSchema = z.object({ pagina: z.coerce.number().int().min(1).max(100000).default(1), porPagina: z.coerce.number().int().min(1).max(10).default(10) }).strict();
export const confirmarExecucaoProtocoloSchema = z.object({
  execucao: execucaoProtocoloSchema, chave: z.string().uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type ExecucaoProtocoloInput = z.infer<typeof execucaoProtocoloSchema>;
export type ItemExecucaoProtocolo = ExecucaoProtocoloInput["itens"][number];
export type FatoReciboProtocolo = { tarefaId: string; animalId: string; tipo: ItemExecucaoProtocolo["tipo"]; id: string };
export type ReciboExecucaoProtocolo = { versao: 1; chave: string; itens: FatoReciboProtocolo[]; total: number; pagina: number; porPagina: number };
