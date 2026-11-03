import { z } from "zod";
export const registrarToqueAptidaoSchema = z.object({
  chave: z.string().uuid(), animalId: z.string().uuid(), propriedadeId: z.number().int().positive(), data: z.string().date(),
  resultado: z.enum(["APTO", "NAO_APTO", "INCONCLUSIVO"]), retornoEm: z.string().date().nullish(),
  responsavel: z.string().trim().min(2).max(160), observacao: z.string().trim().max(4000).nullish(),
  tarefaId: z.string().uuid().optional(),
}).strict().superRefine((e, ctx) => {
  if (e.retornoEm && e.retornoEm <= e.data) ctx.addIssue({ code: "custom", path: ["retornoEm"], message: "Retorno deve ser posterior ao exame" });
});

export const corrigirToqueAptidaoSchema = z.object({
  chave: z.string().uuid(), propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000),
  resultado: z.enum(["APTO", "NAO_APTO", "INCONCLUSIVO"]).optional(), retornoEm: z.string().date().nullish(), anular: z.boolean().optional(),
}).strict().superRefine((e, ctx) => {
  if (!e.anular && !e.resultado) ctx.addIssue({ code: "custom", path: ["resultado"], message: "Informe o resultado corrigido" });
});
