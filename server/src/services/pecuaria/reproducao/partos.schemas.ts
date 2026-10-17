import { z } from "zod";

const uuid = z.string().uuid();
const data = z.string().date();
const motivo = z.string().trim().min(5).max(1000);
const texto = z.string().trim().max(1000).nullish();
const peso = z.number().positive().max(99999);
export const ocorrenciaRetencaoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("VINCULAR"), ocorrenciaId: uuid }).strict(),
  z.object({ acao: z.literal("CRIAR"), doencaId: uuid, inicio: data, observacao: texto }).strict(),
  z.object({ acao: z.literal("DESVINCULAR"), ocorrenciaId: uuid, motivo }).strict(),
]);
export const pesoPartoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("CORRIGIR"), vinculoId: uuid, data, pesoKg: peso, observacao: texto }).strict(),
  z.object({ acao: z.literal("VINCULAR"), pesagemId: uuid }).strict(),
  z.object({ acao: z.literal("REGISTRAR"), data, pesoKg: peso, observacao: texto }).strict(),
  z.object({ acao: z.literal("DESVINCULAR"), vinculoId: uuid, motivo }).strict(),
]);
const dadosEscore = { data, valor: z.number().finite(), escalaMin: z.number().finite(), escalaMax: z.number().finite(), escalaDescricao: z.string().trim().max(300).nullish(), responsavel: z.string().trim().max(160).nullish() };
export const escorePartoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("REGISTRAR"), ...dadosEscore }).strict(),
  z.object({ acao: z.literal("SUBSTITUIR"), exameId: uuid, motivo, ...dadosEscore }).strict(),
  z.object({ acao: z.literal("ANULAR"), exameId: uuid, motivo }).strict(),
]);
const campos = {
  gestacaoId: uuid.nullish(), tipo: z.enum(["NORMAL", "DISTOCICO", "ABORTO", "NATIMORTO", "NASCIMENTO"]).optional(),
  desfecho: z.enum(["NASCIMENTO", "ABORTO"]).nullish(), induzido: z.boolean().nullish(), dificuldade: z.boolean().nullish(),
  assistenciaDescricao: texto, ocorridoEm: z.string().datetime({ offset: true }).nullish(), horarioEstimado: z.boolean().optional(),
  retencaoPlacenta: z.boolean().nullish(), responsavel: z.string().trim().max(160).nullish(), observacao: texto,
  ocorrenciaRetencao: ocorrenciaRetencaoSchema.optional(), pesoMatriz: pesoPartoSchema.optional(), escoreMatriz: escorePartoSchema.optional(),
};
function validarHorario(v: { ocorridoEm?: string | null; horarioEstimado?: boolean }, ctx: z.RefinementCtx) {
  if (v.horarioEstimado && !v.ocorridoEm) ctx.addIssue({ code: "custom", path: ["horarioEstimado"], message: "Horário estimado exige informar o horário do parto" });
}
export const partoAmpliadoSchema = z.object({
  chave: uuid, animalId: uuid, propriedadeId: z.number().int().positive(), data, ...campos,
  iniciarLactacao: z.boolean().default(false),
  crias: z.array(z.object({ viva: z.boolean(), sexo: z.enum(["F", "M"]), aptidao: z.enum(["LEITE", "CORTE"]), brinco: z.string().trim().min(1).max(39).nullish(), nome: z.string().trim().max(120).nullish(), loteId: uuid.nullish(), pesoKg: peso.nullish() }).strict()).max(10).default([]),
}).strict().superRefine((v, ctx) => {
  validarHorario(v, ctx);
  if((v.desfecho==="ABORTO"||v.tipo==="ABORTO")&&(v.observacao?.trim().length??0)<5)ctx.addIssue({code:"custom",path:["observacao"],message:"Explique a observação e o contexto do aborto (ao menos 5 caracteres); a causa clínica pode ser desconhecida"});
  if (!v.tipo && !v.desfecho) ctx.addIssue({ code: "custom", path: ["desfecho"], message: "Informe o desfecho do parto" });
  if (v.escoreMatriz && v.escoreMatriz.acao !== "REGISTRAR") ctx.addIssue({ code: "custom", path: ["escoreMatriz"], message: "Criação do parto admite registro de escore; revisões exigem parto existente" });
  if (v.ocorrenciaRetencao?.acao === "DESVINCULAR" || v.pesoMatriz?.acao === "DESVINCULAR" || v.pesoMatriz?.acao === "CORRIGIR") ctx.addIssue({ code: "custom", message: "Correção ou desvínculo exige parto existente" });
});
export const correcaoPartoAmpliadaSchema = z.object({
  propriedadeId: z.number().int().positive(), chave: uuid.optional(), motivo, versaoEsperada: z.number().int().positive().optional(), ...campos,
  pesosCrias: z.array(z.object({ criaId: uuid, peso: pesoPartoSchema.optional(), pesoKg: peso.nullable().optional() }).strict()).max(10).optional(),
}).strict().superRefine((v,ctx)=>{if((v.desfecho==="ABORTO"||v.tipo==="ABORTO")&&(v.observacao?.trim().length??0)<5)ctx.addIssue({code:"custom",path:["observacao"],message:"Explique a observação e o contexto do aborto; a causa clínica pode ser desconhecida"});});
export type PartoAmpliadoInput = z.infer<typeof partoAmpliadoSchema>;
export type CorrecaoPartoAmpliadaInput = z.infer<typeof correcaoPartoAmpliadaSchema>;
