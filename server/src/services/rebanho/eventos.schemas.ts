import { z } from "zod";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const comum = { data: isoDate, observacao: z.string().max(200).optional() };

export const criarEventoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("CIO"), ...comum }),
  z.object({ tipo: z.literal("INSEMINACAO"), ...comum, reprodutor: z.string().min(1, "reprodutor é obrigatório").max(60), protocolo: z.string().max(40).optional() }),
  // TE: embrião numa receptora. `doadoraId` = animal doador da genética (opcional);
  // `reprodutor` = touro/sêmen do embrião (opcional); `protocolo` = sincronização.
  z.object({ tipo: z.literal("TRANSFERENCIA_EMBRIAO"), ...comum, doadoraId: z.number().int().positive().optional(), reprodutor: z.string().max(60).optional(), protocolo: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("DIAGNOSTICO"), ...comum, resultado: z.enum(["positivo", "negativo"]), dtPartoPrevista: isoDate.optional() }),
  z.object({ tipo: z.literal("PARTO"), ...comum, numCrias: z.number().int().min(1).max(3), sexoCria: z.string().max(2).optional(), tipoParto: z.string().max(20).optional() }),
  z.object({ tipo: z.literal("SECAGEM"), ...comum, motivoSecagem: z.string().max(40).optional() }),
]);
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;
