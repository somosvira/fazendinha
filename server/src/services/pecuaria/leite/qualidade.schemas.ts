import { z } from "zod";
import { camposExameSchema, observacoesExameSchema } from "../exames/formatos.js";
import { dataLeiteSchema, propriedadeLeiteSchema } from "./schemas.js";

const chave = z.string().uuid();
const texto = (maximo: number) => z.string().trim().min(1).max(maximo);
export const criarFormatoQualidadeSchema = z.object({ chave, nome: texto(120), campos: camposExameSchema }).strict();
export const editarFormatoQualidadeSchema = z.object({ nome: texto(120).optional(), ativo: z.boolean().optional(), campos: camposExameSchema.optional() }).strict()
  .refine(v => Object.keys(v).length > 0, "Informe o que deseja alterar no formato");
export const sujeitoQualidadeSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("ANIMAL"), animalId: z.string().uuid() }).strict(),
  z.object({ tipo: z.literal("COLETIVO"), origem: texto(300), entradaId: z.string().uuid().optional() }).strict(),
]);
export const registrarQualidadeSchema = z.object({
  chave, propriedadeId: propriedadeLeiteSchema, data: dataLeiteSchema,
  tipoExameId: z.string().uuid(), formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/),
  sujeito: sujeitoQualidadeSchema, resultados: observacoesExameSchema.default([]),
  responsavel: texto(120).nullish(), anotacaoOriginal: texto(4000).nullish(),
}).strict();
export const corrigirQualidadeSchema = z.object({
  chave, propriedadeId: propriedadeLeiteSchema, versaoEsperada: z.number().int().positive(),
  motivo: texto(1000), resultados: observacoesExameSchema.optional(), anular: z.boolean().default(false),
}).strict().superRefine((v, ctx) => {
  if (!v.anular && !v.resultados?.length) ctx.addIssue({ code: "custom", path: ["resultados"], message: "Informe os resultados corrigidos" });
  if (v.anular && v.resultados?.length) ctx.addIssue({ code: "custom", path: ["resultados"], message: "Anular não substitui os resultados do laudo" });
});
export const consultarQualidadeSchema = z.object({
  inicio: dataLeiteSchema.optional(), fim: dataLeiteSchema.optional(),
  sujeito: z.enum(["ANIMAL", "COLETIVO"]).optional(), animalId: z.string().uuid().optional(),
  pagina: z.coerce.number().int().positive().default(1), tamanho: z.coerce.number().int().min(1).max(100).default(30),
}).strict().superRefine((v, ctx) => {
  if (v.inicio && v.fim && v.inicio > v.fim) ctx.addIssue({ code: "custom", path: ["fim"], message: "Fim anterior ao início" });
  if (v.sujeito === "COLETIVO" && v.animalId) ctx.addIssue({ code: "custom", path: ["animalId"], message: "Amostra coletiva não pertence a um animal" });
});
export const historicoQualidadeSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1), tamanho: z.coerce.number().int().min(1).max(100).default(20),
});
export type CriarFormatoQualidadeInput = z.infer<typeof criarFormatoQualidadeSchema>;
export type EditarFormatoQualidadeInput = z.infer<typeof editarFormatoQualidadeSchema>;
export type RegistrarQualidadeInput = z.infer<typeof registrarQualidadeSchema>;
export type CorrigirQualidadeInput = z.infer<typeof corrigirQualidadeSchema>;
export type ConsultaQualidade = z.infer<typeof consultarQualidadeSchema>;

export const solicitarLaudoQualidadeSchema = z.object({
  propriedadeId: propriedadeLeiteSchema, nome: texto(180),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "application/xml", "text/xml"]),
  tamanhoBytes: z.number().int().positive().max(10 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/i).transform(v => v.toLowerCase()),
}).strict();
export const confirmarLaudoQualidadeSchema = z.object({ propriedadeId: propriedadeLeiteSchema, uploadToken: texto(12000) }).strict();
export type SolicitarLaudoQualidadeInput = z.infer<typeof solicitarLaudoQualidadeSchema>;
export const consultarOrigensQualidadeSchema = z.object({ data: dataLeiteSchema, busca: z.string().trim().max(100).optional(), pagina: z.coerce.number().int().positive().default(1) }).strict();

/** Parâmetro literal do formato; nenhuma equivalência laboratorial é presumida. */
export const consultarParametrosQualidadeSchema = z.object({
  campo: z.string().regex(/^[A-Z][A-Z0-9_]{0,59}$/),
  inicio: dataLeiteSchema, fim: dataLeiteSchema,
  tipoExameId: z.string().uuid().optional(),
  sujeito: z.enum(["ANIMAL", "COLETIVO"]).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamanho: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v => v.inicio <= v.fim, { path: ["fim"], message: "Fim anterior ao início" });
export type ConsultaParametrosQualidade = z.infer<typeof consultarParametrosQualidadeSchema>;
