import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
export const QUARTOS = ["AE", "AD", "PE", "PD"] as const;
export const SCORES_CMT = ["NEGATIVO", "TRACOS", "UMA_CRUZ", "DUAS_CRUZES", "TRES_CRUZES"] as const;

// Uma teta dentro de uma passada. scoreCmt e clinica são independentes: pode ser só rastreio (CMT),
// só clínico (episódio), ou ambos. `perdido` marca quarto seco/agenésico.
const quartoSchema = z.object({
  quarto: z.enum(QUARTOS),
  scoreCmt: z.enum(SCORES_CMT).optional(),
  ccs: z.number().int().min(0).max(9999, "CCS muito alto").optional(),
  clinica: z.boolean().optional(),
  severidade: z.string().max(20).optional(),
  resultadoCultivo: z.string().max(60).optional(),
  perdido: z.boolean().optional(),
  escoreTeto: z.number().int().min(1, "escore de teto vai de 1 a 4").max(4, "escore de teto vai de 1 a 4").optional(),
  observacao: z.string().max(200).optional(),
});

// Uma passada = uma data + 1..4 tetas (sem quarto repetido). Vira 1..4 linhas de ExameQuarto.
export const registrarExameQuartoSchema = z
  .object({
    data: isoDate,
    quartos: z.array(quartoSchema).min(1, "informe ao menos 1 quarto").max(4),
  })
  .refine((v) => new Set(v.quartos.map((q) => q.quarto)).size === v.quartos.length, {
    message: "quarto repetido na mesma passada",
    path: ["quartos"],
  });

export type RegistrarExameQuartoInput = z.infer<typeof registrarExameQuartoSchema>;
