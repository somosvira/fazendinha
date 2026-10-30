import { z } from "zod";

const data = z.string().date();
const uuid = z.string().uuid();
const dias = z.number().int().min(0).max(2000);
export const grupoCriteriosAptidaoSchema = z.object({
  idadeMinimaMeses: z.number().int().min(1).max(360).nullable(),
  percentualPesoAdulto: z.number().positive().max(100).nullable(),
  pesoMinimoKg: z.number().positive().max(2000).nullable(),
  eccMinimo: z.number().nonnegative().max(100).nullable(),
  pesoAdultoReferenciaKg: z.number().positive().max(2000).nullable(),
  validadePesoDias: dias.nullable(),
  precisaoPesoAceita: z.array(z.enum(["MEDIDO", "ESTIMADO", "INFORMADO"])).min(1).max(3),
  escalaEcc: z.object({ minimo: z.number().nonnegative(), maximo: z.number().positive().max(100) }).strict().nullable(),
  validadeEccDias: dias.nullable(),
}).strict().superRefine((g, ctx) => {
  if (g.percentualPesoAdulto !== null && g.pesoAdultoReferenciaKg === null)
    ctx.addIssue({ code: "custom", path: ["pesoAdultoReferenciaKg"], message: "Percentual exige peso adulto de referência" });
  if ((g.percentualPesoAdulto !== null || g.pesoMinimoKg !== null) && g.validadePesoDias === null)
    ctx.addIssue({ code: "custom", path: ["validadePesoDias"], message: "Defina a validade da pesagem" });
  if (new Set(g.precisaoPesoAceita).size !== g.precisaoPesoAceita.length)
    ctx.addIssue({ code: "custom", path: ["precisaoPesoAceita"], message: "Não repita precisões" });
  if (g.eccMinimo !== null && (!g.escalaEcc || g.validadeEccDias === null || g.escalaEcc.minimo >= g.escalaEcc.maximo || g.eccMinimo < g.escalaEcc.minimo || g.eccMinimo > g.escalaEcc.maximo))
    ctx.addIssue({ code: "custom", path: ["escalaEcc"], message: "ECC exige escala compatível e validade explícitas" });
});
export type GrupoCriteriosAptidao = z.infer<typeof grupoCriteriosAptidaoSchema>;
export const criteriosAptidaoSchema = z.object({
  vacas: grupoCriteriosAptidaoSchema, novilhas: grupoCriteriosAptidaoSchema,
  diasAvaliacaoPosParto: dias.nullable(),
}).strict();
export const parametrosElegibilidadeSchema = z.object({
  versao: z.union([z.literal(1), z.literal(2)]),
  criteriosAptidao: criteriosAptidaoSchema.optional(),
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
  if ((p.versao === 2) !== (p.criteriosAptidao !== undefined))
    ctx.addIssue({ code: "custom", path: ["criteriosAptidao"], message: "Critérios explícitos exigem versão 2" });
  if ((p.aborto === "PEV_CONFIGURADO") !== (p.pevAposAbortoDias !== null))
    ctx.addIssue({ code: "custom", path: ["pevAposAbortoDias"], message: "Informe PEV do aborto somente quando a regra for PEV configurado" });
  if (new Set(p.papeisIncluidos).size !== p.papeisIncluidos.length)
    ctx.addIssue({ code: "custom", path: ["papeisIncluidos"], message: "Não repita papéis reprodutivos" });
});
export const criarPoliticaElegibilidadeSchema = z.object({
  chave: uuid, propriedadeId: z.number().int().positive(), vigenteDesde: data,
  parametros: parametrosElegibilidadeSchema,
  motivo: z.string().trim().min(5).max(1000).optional(),
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
  anteciparPev: z.boolean().optional(),
  exameAptidaoId: uuid.optional(),
  acaoLiberada: z.enum(["PROTOCOLO", "IA", "TE"]).optional(),
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
