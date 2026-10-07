import { z } from "zod";

export const consultaProcedimentosServicoSchema = z.object({
  grupo: z.enum(["VINCULADOS", "ELEGIVEIS"]).default("VINCULADOS"),
  animalBusca: z.string().trim().max(160).optional(),
  tipo: z.enum(["APLICACAO", "EXAME", "PROTOCOLO"]).optional(),
  inicio: z.string().date().optional(),
  fim: z.string().date().optional(),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((input, ctx) => {
  if (input.inicio && input.fim && input.fim < input.inicio) ctx.addIssue({ code: "custom", path: ["fim"], message: "O fim deve ser igual ou posterior ao início" });
});
export const confirmarProcedimentosServicoSchema = z.object({
  servicoId: z.string().uuid().optional(), propriedadeId: z.number().int().positive(),
  chaveIdempotencia: z.string().uuid(), motivo: z.string().trim().min(5).max(500),
  itens: z.array(z.object({ id: z.string().uuid(), tipo: z.enum(["APLICACAO", "EXAME", "PROTOCOLO"]),
    valor: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe um valor positivo com até duas casas decimais").nullable().optional(),
  }).strict()).min(1).max(100),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.itens.map((i) => `${i.tipo}:${i.id}`)).size !== input.itens.length) ctx.addIssue({ code: "custom", path: ["itens"], message: "Selecione cada procedimento uma única vez" });
});
export type ConsultaProcedimentosServico = z.infer<typeof consultaProcedimentosServicoSchema>;
export type ConfirmarProcedimentosServico = Omit<z.infer<typeof confirmarProcedimentosServicoSchema>, "servicoId"> & { servicoId: string };
