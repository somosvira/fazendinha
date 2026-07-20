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
  propriedadeId: z.number().int().positive().optional(), // sítio (multi-propriedade)
});

// Edição: tudo opcional + um motivo livre para a movimentação de lote/setor, quando houver
// (só é usado se grupo/setor mudar; ignorado caso contrário).
export const editarAnimalSchema = criarAnimalSchema.partial().extend({
  motivoMovimentacao: z.string().max(200).optional(),
});

export const baixaSchema = z.object({
  motivo: z.string().min(1, "motivo é obrigatório").max(60),
  data: isoDate.optional(),
});

// Alteração coletiva (bulk): aplica grupo e/ou setor a vários animais. Ao menos um dos dois.
export const bulkAnimaisSchema = z.object({
  animalIds: z.array(z.number().int().positive()).min(1, "selecione ao menos um animal").max(1000),
  grupoId: z.number().int().positive().nullable().optional(),
  setor: z.string().max(40).nullable().optional(),
}).refine((v) => v.grupoId !== undefined || v.setor !== undefined, {
  message: "informe grupo e/ou setor para alterar",
  path: ["grupoId"],
});
export type BulkAnimaisInput = z.infer<typeof bulkAnimaisSchema>;

const CATEGORIAS = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "TOURO", "CABRITA", "CABRA", "CABRITO", "BODE"] as const;

export const listFiltrosSchema = z.object({
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.coerce.number().int().positive().optional(),
  q: z.string().max(40).optional(),
  setor: z.string().max(40).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  propriedadeId: z.coerce.number().int().positive().optional(), // filtro por sítio
});

// Filtro de animais salvo (nomeado). Critérios = os do listFiltros + categoria; sem propriedadeId
// (resolvido no escopo). `status` default ATIVO.
export const criarFiltroSchema = z.object({
  nome: z.string().min(1, "informe o nome do filtro").max(80),
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.number().int().positive().nullable().optional(),
  setor: z.string().max(40).nullable().optional(),
  categoria: z.enum(CATEGORIAS).nullable().optional(),
  busca: z.string().max(40).nullable().optional(),
});
export type CriarFiltroInput = z.infer<typeof criarFiltroSchema>;

export type CriarAnimalInput = z.infer<typeof criarAnimalSchema>;
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;
export type BaixaInput = z.infer<typeof baixaSchema>;
export type ListFiltros = z.infer<typeof listFiltrosSchema>;
