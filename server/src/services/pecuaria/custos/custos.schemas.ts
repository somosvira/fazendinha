import { z } from "zod";
const id = z.string().uuid();
const valor = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe valor não negativo com até dois decimais");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Data inválida");
export const tipoFonteSchema = z.enum(["TENTATIVA", "APLICACAO", "EXAME", "PARTICIPACAO", "NUTRICAO"]);
export const classificacaoCustoSchema = z.object({
  chave: id, propriedadeId: z.number().int().positive().max(2147483647), tipo: tipoFonteSchema, fonteId: id,
  versao: z.number().int().min(0), motivo: z.string().trim().min(5).max(500),
  finalidade: z.enum(["REPRODUCAO", "SANIDADE", "ROTINA"]).nullable(),
  materialNaoAplicavel: z.boolean(), servicoNaoAplicavel: z.boolean(), coberturaServico: z.enum(["PROCEDIMENTO", "MATERIAL", "AMBOS"]),
  materialDocumentado: z.object({ valor, referencia: z.string().trim().min(2).max(200), evidencia: z.string().trim().min(5).max(2000) }).strict().nullable().optional(),
}).strict();
export const vinculoPreparoSchema = z.object({ chave: id, propriedadeId: z.number().int().positive().max(2147483647),
  tentativaId: id, tipo: z.enum(["APLICACAO", "EXAME", "PARTICIPACAO"]), fonteId: id,
  modo: z.enum(["INTEGRAL", "PARCELA"]), valorMaterial: valor.nullish(), valorServico: valor.nullish(), motivo: z.string().trim().min(5).max(500),
}).strict().superRefine((v,c) => {
  if (v.modo === "PARCELA" && v.valorMaterial == null && v.valorServico == null) c.addIssue({ code: "custom", path: ["valorMaterial"], message: "Informe ao menos uma parcela explícita" });
  if (v.modo === "INTEGRAL" && (v.valorMaterial != null || v.valorServico != null)) c.addIssue({ code: "custom", path: ["modo"], message: "Integral utiliza os valores originais sem novas parcelas" });
});
export const consultaCustosSchema = z.object({ animalId: id.optional(), tentativaId: id.optional(), participacaoId: id.optional(), aplicacaoId: id.optional(), exameId: id.optional(), programacaoId: id.optional(),
  inicio: data.optional(), fim: data.optional(), finalidade: z.enum(["REPRODUCAO", "SANIDADE", "ROTINA", "SEM_CLASSIFICACAO"]).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1), limite: z.coerce.number().int().min(1).max(100).default(25),
}).refine(v => Number(!!v.animalId) + Number(!!v.tentativaId) + Number(!!v.participacaoId) + Number(!!v.aplicacaoId) + Number(!!v.exameId) + Number(!!v.programacaoId) === 1, "Selecione animal, tentativa, participação ou programação").refine(v => !v.inicio || !v.fim || v.inicio <= v.fim, "Período inválido");
export type ConsultaCustos = z.infer<typeof consultaCustosSchema>;
export type ClassificacaoCustoInput = z.infer<typeof classificacaoCustoSchema>;
export type VinculoPreparoInput = z.infer<typeof vinculoPreparoSchema>;
