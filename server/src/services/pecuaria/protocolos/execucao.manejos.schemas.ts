import { z } from "zod";
import { dataOuHorario } from "../reproducao/schemas.js";
const base={animalId:z.string().uuid(),propriedadeId:z.number().int().positive(),tarefaId:z.string().uuid(),data:z.string().date(),realizadaEm:dataOuHorario.optional(),responsavel:z.string().trim().max(160).nullish(),observacao:z.string().trim().max(1000).nullish(),operacaoServicoId:z.string().uuid().nullish(),valorServicoAtribuido:z.string().regex(/^\d+(\.\d{1,2})?$/).nullish(),desvio:z.object({motivo:z.string().trim().min(5).max(500)}).strict().optional(),cienciaSanitaria:z.boolean().optional(),cienciaRecalendarioLegado:z.boolean().optional()};
export const manejoProtocoloSchema=z.object({...base,tipo:z.literal("MANEJO")}).strict();
export const retiradaProtocoloSchema=z.object({...base,tipo:z.literal("RETIRADA"),insercaoAplicacaoId:z.string().uuid()}).strict();
export const itemExecucaoManejoSchema=z.discriminatedUnion("tipo",[manejoProtocoloSchema,retiradaProtocoloSchema]);
export type ItemExecucaoManejo=z.infer<typeof itemExecucaoManejoSchema>;
export const anularManejoProtocoloSchema=z.object({chave:z.string().uuid(),propriedadeId:z.number().int().positive(),motivo:z.string().trim().min(5).max(1000),realizacaoMantida:z.boolean(),cienciaNaoExecutado:z.boolean().optional()}).strict();
