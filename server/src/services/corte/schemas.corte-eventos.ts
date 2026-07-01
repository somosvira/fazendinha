/* Schemas Zod dos eventos do Corte (Onda 2) — manejo sanitário, suplementação
 * e operação comercial. Espelham os enums/colunas do schema Prisma (MÓDULO
 * CORTE). Campos opcionais usam `.nullish()` (aceitam null OU ausência — lição
 * da revisão do plantio); datas ISO viram Date via helper que protege null→undefined.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

/** ISO YYYY-MM-DD → Date, propagando null/undefined sem virar Invalid Date. */
export const toDate = (s?: string | null): Date | undefined => (s ? new Date(s) : undefined);

export const tipoSanitario = z.enum([
  "VACINA_AFTOSA",
  "VACINA_BRUCELOSE_B19",
  "VACINA_CLOSTRIDIOSE",
  "VACINA_RAIVA",
  "VACINA_CARBUNCULO",
  "VACINA_LEPTOSPIROSE",
  "VACINA_IBR_BVD",
  "VERMIFUGACAO_5811",
  "VERMIFUGACAO_ESTRATEGICA",
  "CONTROLE_CARRAPATO",
  "CONTROLE_MOSCA",
  "CONTROLE_BERNE",
  "MARCACAO",
  "DESCORNA",
  "CASTRACAO",
  "BRINCO_ELETRONICO",
]);

export const tipoSuplemento = z.enum([
  "MINERAL",
  "PROTEICO_SECA",
  "ENERGETICO_AGUAS",
  "RACAO_CONFINAMENTO",
  "SAL_BRANCO",
]);

export const tipoComercial = z.enum([
  "VENDA_ABATE",
  "VENDA_REPRODUCAO",
  "DESCARTE",
  "COMPRA",
  "TRANSFERENCIA_ATIVIDADE",
]);

export const criarManejoSchema = z.object({
  data: isoDate,
  tipo: tipoSanitario,
  produto: z.string().max(200).nullish(),
  doseMl: z.number().nonnegative().nullish(),
  numCabecas: z.number().int().positive(),
  responsavel: z.string().max(80).nullish(),
  carenciaDias: z.number().int().nonnegative().nullish(),
  proximaDose: isoDate.nullish(),
  observacao: z.string().max(400).nullish(),
});

export const criarSuplementacaoSchema = z.object({
  dataInicio: isoDate,
  dataFim: isoDate.nullish(),
  tipo: tipoSuplemento,
  produto: z.string().min(1, "produto é obrigatório").max(120),
  consumoCabecaDiaG: z.number().nonnegative(),
  custoKg: z.number().nonnegative().nullish(),
  observacao: z.string().max(400).nullish(),
});

export const criarOperacaoSchema = z.object({
  loteId: z.number().int().positive().nullish(),
  data: isoDate,
  tipo: tipoComercial,
  numCabecas: z.number().int().positive(),
  pesoMedio: z.number().positive("peso médio deve ser > 0"),
  arrobas: z.number().nonnegative().nullish(),
  precoArroba: z.number().nonnegative().nullish(),
  comprador: z.string().max(120).nullish(),
  observacao: z.string().max(400).nullish(),
});

export type CriarManejoInput = z.infer<typeof criarManejoSchema>;
export type CriarSuplementacaoInput = z.infer<typeof criarSuplementacaoSchema>;
export type CriarOperacaoInput = z.infer<typeof criarOperacaoSchema>;
