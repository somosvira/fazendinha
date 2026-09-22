import { z } from "zod";

// Composição (receita) de um produto — ração formulada: lista completa de
// ingredientes com sua proporção (substitui a existente).
export const composicaoRacaoBodySchema = z.object({
  itens: z.array(z.object({
    ingredienteId: z.number().int().positive(),
    proporcao: z.number().min(0).max(100),
  })).max(50),
});
export type ComposicaoRacaoBodyInput = z.infer<typeof composicaoRacaoBodySchema>;
