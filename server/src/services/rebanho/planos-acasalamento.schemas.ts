import { z } from "zod";

// Payloads das rotas de planos versionados de acasalamento por lote.
export const criarPlanoAcasalamentoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  grupoId: z.number().int().positive(),
  combinacaoId: z.number().int().positive(),
});
export type CriarPlanoAcasalamentoInput = z.infer<
  typeof criarPlanoAcasalamentoSchema
>;

export const escolherReprodutorPlanoSchema = z.object({
  reprodutorId: z.number().int().positive(),
  confirmadoNaoVerificavel: z.boolean().default(false),
});
export type EscolherReprodutorPlanoInput = z.infer<
  typeof escolherReprodutorPlanoSchema
>;
