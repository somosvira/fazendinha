import { z } from "zod";

export { TITULO_SANITARIO, TITULO_PESAGEM_LOTE } from "./corte.constants.js";
export {
  tituloEventoSanitario, detalheEventoSanitario, alertaEventoSanitario,
  tituloControleLeiteiro, detalheControleLeiteiro,
} from "./rebanho.constants.js";
export { criarEventoSanitarioSchema, type CriarEventoSanitarioInput } from "./rebanho.eventos-sanidade.schemas.js";
export { QUARTOS, SCORES_CMT, registrarExameQuartoSchema, type RegistrarExameQuartoInput } from "./rebanho.exames-quarto.schemas.js";
export { controleSchema, type ControleInput } from "./rebanho.producao.schemas.js";
export {
  recomputarQuartos, CCS_POSITIVO, JANELA_MESES, DIAS_ATIVO,
  type Quarto, type ScoreCmt, type EstadoQuarto, type ExameQuartoIn, type EstadoPorQuarto, type ResumoQuartos,
} from "./rebanho.recompute.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "hora deve ser HH:MM");
const tipoDiaPontoSchema = z.enum(["UTIL", "DOMINGO", "FERIADO", "FOLGA", "FALTA"]);

export const upsertRegistroSchema = z.object({
  funcionarioId: z.coerce.number().int().positive(),
  data: isoDate,
  entrada: hhmm.nullish(),
  saida: hhmm.nullish(),
  intervaloMin: z.number().int().nonnegative().default(60),
  tipoDia: tipoDiaPontoSchema.default("UTIL"),
  observacao: z.string().max(400).nullish(),
});

export type UpsertRegistroSchemaInput = z.infer<typeof upsertRegistroSchema>;

// Corte > Pesagem
export const metodoPesagem = z.enum([
  "BALANCA_INDIVIDUAL",
  "BALANCA_LOTE",
  "FITA_TORACICA",
  "VISUAL_ESTIMADO",
]);

export const criarPesagemSchema = z.object({
  data: isoDate,
  pesoMedio: z.number().positive("peso médio deve ser > 0"),
  numCabecas: z.number().int().positive(),
  metodo: metodoPesagem,
  responsavel: z.string().max(80).nullish(),
  observacao: z.string().max(400).nullish(),
});

export type CriarPesagemInput = z.infer<typeof criarPesagemSchema>;

// Corte > Sanidade (manejo sanitário)
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

export type CriarManejoInput = z.infer<typeof criarManejoSchema>;
