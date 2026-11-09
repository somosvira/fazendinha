import { z } from "zod";

export const consultaCatalogoSchema = z.object({
  busca: z.string().trim().max(160).default(""),
  ativo: z.enum(["true", "false"]).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(10),
  selecionadoId: z.string().uuid().optional(),
}).strict();
const nome = z.string().trim().min(2).max(160);
export const criarCatalogoSchema = z.object({ nome, chaveReenvio: z.string().uuid() }).strict();
export const patchCatalogoSchema = z.object({
  nome: nome.optional(), ativo: z.boolean().optional(), revisaoEsperada: z.number().int().positive(),
  motivoAlteracao: z.string().trim().min(5).max(500).optional(), chaveReenvio: z.string().uuid(),
}).strict();
export const criarPrincipioSchema = criarCatalogoSchema.extend({ nome: nome.max(100) });
export const patchPrincipioSchema = z.object({ nome: nome.max(100).optional(), ativo: z.boolean().optional(), revisaoEsperada: z.number().int().positive(), motivoAlteracao: z.string().trim().min(5).max(500).optional(), chaveReenvio: z.string().uuid() }).strict();
export const unidadeNutrienteSchema = z.enum(["PERCENTUAL", "MG_KG", "MCAL_KG"]);
export const criarNutrienteSchema = criarPrincipioSchema.extend({ nomeCompleto: z.string().trim().max(300).nullable().optional(), unidadeReferencia: unidadeNutrienteSchema });
export const patchNutrienteSchema = z.object({ nome: nome.max(100).optional(), nomeCompleto: z.string().trim().max(300).nullable().optional(), unidadeReferencia: unidadeNutrienteSchema.optional(), ativo: z.boolean().optional(), revisaoEsperada: z.number().int().positive(), motivoAlteracao: z.string().trim().min(5).max(500).optional(), chaveReenvio: z.string().uuid() }).strict();
export type ConsultaCatalogo = z.infer<typeof consultaCatalogoSchema>;
