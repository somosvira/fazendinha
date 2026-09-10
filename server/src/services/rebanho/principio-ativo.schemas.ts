import { z } from "zod";
import { composicaoPrincipiosAtivosSchema } from "@fazendinha/shared";

// Catálogo de princípios ativos.
export const criarPrincipioSchema = z.object({
  nome: z.string().min(1, "informe o nome do princípio ativo").max(120),
  ehAntibiotico: z.boolean().optional(),
  carenciaLeiteHoras: z.number().int().min(0).max(2000).nullable().optional(),
  carenciaCarneDias: z.number().int().min(0).max(365).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type CriarPrincipioInput = z.infer<typeof criarPrincipioSchema>;

export const atualizarPrincipioSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  ehAntibiotico: z.boolean().optional(),
  carenciaLeiteHoras: z.number().int().min(0).max(2000).nullable().optional(),
  carenciaCarneDias: z.number().int().min(0).max(365).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type AtualizarPrincipioInput = z.infer<typeof atualizarPrincipioSchema>;

// Composição de um produto: a lista completa de princípios (substitui a existente).
export const definirComposicaoSchema = composicaoPrincipiosAtivosSchema;
export type DefinirComposicaoInput = z.infer<typeof definirComposicaoSchema>;
