import { z } from "zod";

const data = z.string().date();
const uuid = z.string().uuid();
const dias = z.number().int().min(0).max(2000);
export const parametrosElegibilidadeSchema = z.object({
  versao: z.literal(1),
  metodologia: z.literal("IDEAGRI_IILB_BASE_V1"),
  pevPrimiparasDias: dias,
  pevMultiparasDias: dias,
  aborto: z.enum(["PEV_CONFIGURADO", "LIBERACAO_EXPLICITA"]),
  pevAposAbortoDias: dias.nullable(),
  descarte: z.enum(["EXCLUIR", "INCLUIR"]),
  restricoes: z.enum(["EXCLUIR", "APENAS_ALERTAR"]),
  perdaGestacional: z.enum(["EXIGE_LIBERACAO", "RETOMAR_CICLO"]),
  papeisIncluidos: z.array(z.enum(["NENHUM", "DOADORA", "RECEPTORA"])).min(1).max(3),
}).strict().superRefine((p, ctx) => {
  if ((p.aborto === "PEV_CONFIGURADO") !== (p.pevAposAbortoDias !== null))
    ctx.addIssue({ code: "custom", path: ["pevAposAbortoDias"], message: "Informe PEV do aborto somente quando a regra for PEV configurado" });
  if (new Set(p.papeisIncluidos).size !== p.papeisIncluidos.length)
    ctx.addIssue({ code: "custom", path: ["papeisIncluidos"], message: "Não repita papéis reprodutivos" });
});
export const criarPoliticaElegibilidadeSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive(), vigenteDesde: data,
  parametros: parametrosElegibilidadeSchema,
}).strict();
export const vincularPoliticaCicloSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive(), animalId: uuid,
  partoId: uuid.optional(), situacaoInicialId: uuid.optional(),
}).strict().superRefine((v, ctx) => {
  if (Boolean(v.partoId) === Boolean(v.situacaoInicialId))
    ctx.addIssue({ code: "custom", message: "Informe parto ou situação inicial para identificar o ciclo" });
});
export const decidirElegibilidadeCicloSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive(), vinculoCicloId: uuid,
  data, tipo: z.enum(["LIBERAR", "BLOQUEAR", "RETOMAR_POLITICA"]),
  aptaDesde: data.nullable(), motivo: z.string().trim().min(5).max(1000),
}).strict().superRefine((v, ctx) => {
  if (v.tipo === "LIBERAR" && (!v.aptaDesde || v.aptaDesde < v.data))
    ctx.addIssue({ code: "custom", path: ["aptaDesde"], message: "Liberação exige apta desde a data da decisão ou depois" });
  if (v.tipo !== "LIBERAR" && v.aptaDesde !== null)
    ctx.addIssue({ code: "custom", path: ["aptaDesde"], message: "Apta desde pertence à liberação" });
});
export const anularDecisaoElegibilidadeSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000),
}).strict();
export type ParametrosElegibilidade = z.infer<typeof parametrosElegibilidadeSchema>;
export type CriarPoliticaElegibilidadeInput = z.infer<typeof criarPoliticaElegibilidadeSchema>;
export type VincularPoliticaCicloInput = z.infer<typeof vincularPoliticaCicloSchema>;
export type DecidirElegibilidadeCicloInput = z.infer<typeof decidirElegibilidadeCicloSchema>;
