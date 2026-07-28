import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const textoOpcional = (max: number) => z.string().trim().max(max).optional();

export const oocitoInputSchema = z.object({ qualidade: z.string().trim().min(1).max(40), viavel: z.boolean(), quantidade: z.number().int().positive() });
export const criarColetaSchema = z.object({
  doadoraId: z.number().int().positive(), data: isoDate, tecnico: textoOpcional(120),
  metodo: z.enum(["FIV", "TE_CONVENCIONAL"]), laboratorio: textoOpcional(120),
  observacao: textoOpcional(500), oocitos: z.array(oocitoInputSchema).default([]),
});
export const atualizarColetaSchema = criarColetaSchema.partial();
export const cancelarColetaSchema = z.object({ motivo: z.string().trim().min(1).max(300) });
export const criarClassificacaoEmbriaoSchema = z.object({ sigla: z.string().trim().min(1).max(40), nome: z.string().trim().min(1).max(120), ordem: z.number().int().optional(), ativo: z.boolean().optional() });
export const adicionarFertilizacaoSchema = z.object({ reprodutorId: z.number().int().positive(), estoqueSemenId: z.number().int().positive().optional(), data: isoDate.optional(), tecnica: textoOpcional(120) });
export const cancelarFertilizacaoSchema = z.object({ motivo: z.string().trim().min(1).max(300) });
export const adicionarEmbriaoSchema = z.object({
  classificacaoId: z.number().int().positive().optional(), codigoInterno: textoOpcional(80),
  estagio: z.enum(["MORULA", "BLASTOCISTO_INICIAL", "BLASTOCISTO", "BLASTOCISTO_EXPANDIDO", "BLASTOCISTO_ECLODINDO", "BLASTOCISTO_ECLODIDO"]).optional(),
  viavel: z.boolean().default(true),
});
export const descartarEmbriaoSchema = z.object({ motivo: textoOpcional(300) });

export type CriarColetaInput = z.infer<typeof criarColetaSchema>;
export type AtualizarColetaInput = z.infer<typeof atualizarColetaSchema>;
export type CriarClassificacaoEmbriaoInput = z.infer<typeof criarClassificacaoEmbriaoSchema>;
export type AdicionarFertilizacaoInput = z.infer<typeof adicionarFertilizacaoSchema>;
export type AdicionarEmbriaoInput = z.infer<typeof adicionarEmbriaoSchema>;
