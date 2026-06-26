import { z } from "zod";

const sexo = z.enum(["F", "M"]);
const categoria = z.enum(["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "TOURO", "CABRITA", "CABRA", "CABRITO", "BODE"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const criarAnimalSchema = z.object({
  numero: z.string().min(1, "número é obrigatório").max(20),
  nome: z.string().max(60).optional(),
  sexo,
  categoria,
  racaId: z.number().int().positive().optional(),
  grauSangue: z.string().max(30).optional(),
  dataNascimento: isoDate.optional(),
  dataEntrada: isoDate,
  brincoEletronico: z.string().max(20).optional(),
  sisbov: z.string().max(20).optional(),
  maeId: z.number().int().positive().optional(),
  paiNome: z.string().max(60).optional(),
  grupoId: z.number().int().positive().optional(),
  setor: z.string().max(40).optional(),
});

export const editarAnimalSchema = criarAnimalSchema.partial();

export const baixaSchema = z.object({
  motivo: z.string().min(1, "motivo é obrigatório").max(60),
  data: isoDate.optional(),
});

export const listFiltrosSchema = z.object({
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.coerce.number().int().positive().optional(),
  q: z.string().max(40).optional(),
  setor: z.string().max(40).optional(),
});

export type CriarAnimalInput = z.infer<typeof criarAnimalSchema>;
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;
export type BaixaInput = z.infer<typeof baixaSchema>;
export type ListFiltros = z.infer<typeof listFiltrosSchema>;
