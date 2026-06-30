import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const categoriaLote = z.enum([
  "VACA_MATRIZ",
  "TOURO",
  "BEZERRO_MAMA",
  "BEZERRA_MAMA",
  "BEZERRO_DESMAMA",
  "BEZERRA_DESMAMA",
  "GAROTE",
  "NOVILHA",
  "NOVILHO",
  "BOI_GORDO",
  "VACA_DESCARTE",
]);

export const faseCiclo = z.enum(["CRIA", "RECRIA", "TERMINACAO", "REPRODUCAO"]);
export const estadoLote = z.enum(["ATIVO", "VENDIDO", "EXTINTO"]);

export const criarLoteSchema = z.object({
  codigo: z.string().min(1, "código é obrigatório").max(20),
  nome: z.string().min(1, "nome é obrigatório").max(80),
  categoria: categoriaLote,
  fase: faseCiclo,
  raca: z.string().min(1, "raça é obrigatória").max(60),
  numCabecas: z.number().int().nonnegative(),
  numCabecasEntrada: z.number().int().nonnegative(),
  dataFormacao: isoDate,
  origem: z.string().max(200).nullish(),
  piqueteId: z.number().int().positive().nullish(),
  estado: estadoLote.default("ATIVO"),
  observacao: z.string().max(400).nullish(),
});

export const editarLoteSchema = criarLoteSchema.partial();

export const baixaLoteSchema = z.object({
  estado: z.enum(["VENDIDO", "EXTINTO"]),
  motivo: z.string().max(120).nullish(),
  data: isoDate.optional(),
});

export const listFiltrosSchema = z.object({
  estado: z.enum(["ATIVO", "VENDIDO", "EXTINTO", "TODOS"]).default("ATIVO"),
  categoria: categoriaLote.optional(),
  q: z.string().max(40).optional(),
});

export type CriarLoteInput = z.infer<typeof criarLoteSchema>;
export type EditarLoteInput = z.infer<typeof editarLoteSchema>;
export type BaixaLoteInput = z.infer<typeof baixaLoteSchema>;
export type ListFiltros = z.infer<typeof listFiltrosSchema>;
