import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const estado = z.enum(["ATIVO", "RECEPADO", "FORMACAO", "BAIXADO"]);
const exposicao = z.enum(["norte", "sul", "leste", "oeste"]);

export const criarTalhaoSchema = z.object({
  codigo: z.string().min(1, "código é obrigatório").max(20),
  nome: z.string().max(80).optional(),
  variedadeId: z.number().int().positive(),
  lavouraId: z.number().int().positive().optional(),
  espacamento: z.string().max(40).optional(),
  plantasHa: z.number().int().nonnegative(),
  areaHa: z.number().nonnegative(),
  anoPlantio: z.number().int(),
  altitude: z.number().int().optional(),
  exposicao: exposicao.optional(),
  declive: z.number().optional(),
  irrigado: z.boolean().default(false),
  estado: estado.default("ATIVO"),
  dataPlantio: isoDate,
  ultimaRecepa: isoDate.optional(),
  observacao: z.string().max(400).optional(),
});

export const editarTalhaoSchema = criarTalhaoSchema.partial();

export const baixaSchema = z.object({
  motivo: z.string().min(1, "motivo é obrigatório").max(80),
  data: isoDate.optional(),
});

export const listFiltrosSchema = z.object({
  estado: z.enum(["ATIVO", "RECEPADO", "FORMACAO", "BAIXADO", "TODOS"]).default("ATIVO"),
  lavoura: z.string().max(80).optional(),
  q: z.string().max(40).optional(),
});

export type CriarTalhaoInput = z.infer<typeof criarTalhaoSchema>;
export type EditarTalhaoInput = z.infer<typeof editarTalhaoSchema>;
export type BaixaInput = z.infer<typeof baixaSchema>;
export type ListFiltros = z.infer<typeof listFiltrosSchema>;
