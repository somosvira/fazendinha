import { z } from "zod";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const agendarVacinaSchema = z.object({
  vacina: z.string().min(1).max(80),
  dataPrevista: dataISO,
  observacao: z.string().max(500).optional(),
});
export type AgendarVacinaInput = z.infer<typeof agendarVacinaSchema>;

export const marcarAplicadaSchema = z.object({
  aplicadaEm: dataISO.optional(), // default = hoje quando ausente
});
export type MarcarAplicadaInput = z.infer<typeof marcarAplicadaSchema>;
