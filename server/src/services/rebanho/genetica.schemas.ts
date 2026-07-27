import { z } from "zod";

export const criarIndicadorSchema = z.object({
  sigla: z.string().min(1).max(40),
  nome: z.string().min(1).max(120),
  unidade: z.string().nullable().optional(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]).optional(),
  colunaLegada: z.enum(["ptaLeite", "ptaGordura", "ptaProteina", "tpi"]).nullable().optional(),
  ranking: z.boolean().optional(),
  ativo: z.boolean().optional(),
});
export type CriarIndicadorInput = z.infer<typeof criarIndicadorSchema>;

export const atualizarIndicadorSchema = criarIndicadorSchema.partial();
export type AtualizarIndicadorInput = z.infer<typeof atualizarIndicadorSchema>;

export const criarDicionarioSchema = z.object({
  sigla: z.string().min(1).max(40),
  nome: z.string().min(1).max(120),
});
export type CriarDicionarioInput = z.infer<typeof criarDicionarioSchema>;

const pedigreeSchema = z.object({
  paiNome: z.string().nullable(),
  paiCodigo: z.string().nullable(),
  maeNome: z.string().nullable(),
  maeCodigo: z.string().nullable(),
  avoMaternoNome: z.string().nullable(),
  avoMaternoCodigo: z.string().nullable(),
  avoPaternoNome: z.string().nullable(),
  avoPaternoCodigo: z.string().nullable(),
});

export const salvarFichaSchema = z.object({
  valoresIndicador: z.array(z.object({
    indicadorId: z.number().int().positive(),
    valor: z.number(),
  })),
  valoresMarcador: z.array(z.object({
    marcadorId: z.number().int().positive(),
    resultado: z.string(),
  })),
  valoresCaseina: z.array(z.object({
    caseinaId: z.number().int().positive(),
    genotipo: z.string(),
  })),
  pedigree: pedigreeSchema.nullable().optional(),
});
export type SalvarFichaInput = z.infer<typeof salvarFichaSchema>;
