import { z } from "zod";
const data = z.string().date();
export const publicoProgramacaoSchema = z.object({
  sexo: z.enum(["M", "F"]).optional(), idadeMinimaMeses: z.number().int().min(0).max(1200).optional(),
  idadeMaximaMeses: z.number().int().min(0).max(1200).optional(), criterioPendente: z.string().trim().max(1000).optional(),
}).strict().refine(p => p.idadeMinimaMeses == null || p.idadeMaximaMeses == null || p.idadeMinimaMeses <= p.idadeMaximaMeses, "Faixa de idade inválida");
export const cadastroProgramacaoSchema = z.object({
  propriedadeId: z.number().int().positive().max(2147483647), nome: z.string().trim().min(2).max(160),
  tipo: z.enum(["VACINACAO", "VERIFICACAO", "VERMIFUGACAO"]), meses: z.array(z.number().int().min(1).max(12)).min(1).max(12).refine(v => new Set(v).size === v.length, "Meses repetidos"),
  ano: z.number().int().min(1).max(9999).nullable().default(null), vigenciaInicio: data.nullable().default(null), vigenciaFim: data.nullable().default(null),
  precisao: z.enum(["MES", "DIA"]), dia: z.number().int().min(1).max(31).nullable().default(null),
  recorrencia: z.enum(["JANELA_ELEGIBILIDADE", "CAMPANHA_ANUAL", "SEM_REPETICAO"]),
  produtoId: z.string().uuid().nullable().default(null), procedimento: z.string().trim().min(2).max(500).nullable().default(null),
  publico: publicoProgramacaoSchema, publicoConferido: z.boolean().default(false), fonte: z.string().trim().max(1000).nullable().default(null),
  observacao: z.string().trim().max(2000).nullable().default(null), sujeitoTipo: z.enum(["ANIMAL", "LOTE", "SITIO"]),
  executor: z.enum(["APLICACAO", "EXAME_ANIMAL"]).nullable().default(null), tipoExameId: z.string().uuid().nullable().default(null),
  antecedenciaDias: z.number().int().min(0).max(365).default(0), regraEquivalenteId: z.string().uuid().nullable().default(null),
}).strict().superRefine((v, c) => {
  if ((v.precisao === "MES" && v.dia !== null) || (v.precisao === "DIA" && v.dia === null)) c.addIssue({ code: "custom", path: ["dia"], message: "Informe dia somente para precisão diária" });
  if (v.vigenciaInicio && v.vigenciaFim && v.vigenciaFim < v.vigenciaInicio) c.addIssue({ code: "custom", path: ["vigenciaFim"], message: "Fim anterior ao início da vigência" });
});
export type CadastroProgramacao = z.infer<typeof cadastroProgramacaoSchema>;
export const consultaProgramacoesSchema = z.object({ ano: z.coerce.number().int().min(1).max(9999), mes: z.coerce.number().int().min(1).max(12).optional(),
  busca: z.string().trim().max(160).default(""), tipo: z.enum(["VACINACAO", "VERIFICACAO", "VERMIFUGACAO"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1), tamanho: z.coerce.number().int().min(1).max(100).default(30), propriedadeId: z.coerce.number().int().positive().max(2147483647).optional() }).strict();
export type ConsultaProgramacoes = z.infer<typeof consultaProgramacoesSchema>;
