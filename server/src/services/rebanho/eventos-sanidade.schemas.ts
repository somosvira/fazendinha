import { z } from "zod";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const comum = { data: isoDate, observacao: z.string().max(200).optional() };
export const criarEventoSanitarioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("OCORRENCIA"), ...comum, doenca: z.string().min(1).max(60), dtFim: isoDate.optional(), diasTratamento: z.number().int().min(0).optional() }),
  z.object({ tipo: z.literal("APLICACAO"), ...comum, produto: z.string().min(1).max(60), dose: z.string().max(20).optional(), carencia: z.number().int().min(0).optional(), loteProduto: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("EXAME"), ...comum, ccs: z.number().int().min(0), gordura: z.number().optional(), proteina: z.number().optional() }),
  z.object({ tipo: z.literal("MASTITE"), ...comum, quarto: z.string().max(4).optional(), severidade: z.string().max(20).optional(), resultadoCultivo: z.string().max(60).optional() }),
  z.object({ tipo: z.literal("VACINA"), ...comum, produto: z.string().min(1).max(60) }),
]);
export type CriarEventoSanitarioInput = z.infer<typeof criarEventoSanitarioSchema>;
