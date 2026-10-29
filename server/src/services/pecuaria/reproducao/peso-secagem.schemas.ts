import { z } from "zod";
import { pesagemSchema, dataNaoFutura } from "../rebanho/schemas.js";
const uuid = z.string().uuid();
const motivo = z.string().trim().min(5).max(1000);
const pesoKg = pesagemSchema.innerType().shape.pesoKg;
const dados = { data: dataNaoFutura, pesoKg, origem: z.enum(["MANUAL", "BALANCA"]), precisao: z.enum(["MEDIDO", "ESTIMADO", "INFORMADO", "NAO_INFORMADO"]), observacao: z.string().trim().max(500).nullish() };
const registrar = z.object({ acao: z.literal("REGISTRAR"), ...dados }).strict();
const vincular = z.object({ acao: z.literal("VINCULAR"), pesagemId: uuid }).strict();
export const origemPesoSecagemSchema = z.discriminatedUnion("acao", [registrar, vincular]);
export const pesoSecagemSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("NAO_INFORMAR") }).strict(), registrar, vincular,
  z.object({ acao: z.literal("CORRIGIR"), vinculoId: uuid, ...dados, origem: dados.origem.optional(), precisao: dados.precisao.optional(), motivo: motivo.optional() }).strict(),
  z.object({ acao: z.literal("SUBSTITUIR"), vinculoId: uuid, motivo: motivo.optional(), pesagem: origemPesoSecagemSchema }).strict(),
  z.object({ acao: z.literal("DESVINCULAR"), vinculoId: uuid, motivo: motivo.optional() }).strict(),
]).superRefine((v, ctx) => {
  const p = v.acao === "REGISTRAR" || v.acao === "CORRIGIR" ? v : v.acao === "SUBSTITUIR" && v.pesagem.acao === "REGISTRAR" ? v.pesagem : null;
  if (p?.origem === "BALANCA" && ["ESTIMADO", "INFORMADO"].includes(p.precisao ?? "")) ctx.addIssue({ code: "custom", path: ["precisao"], message: "Estimativa ou peso informado não é aferição por balança" });
});
export const encerramentoLactacaoSchema = z.object({
  propriedadeId: z.number().int().positive(), data: dataNaoFutura, motivo, chave: uuid.optional(),
  pesoSecagem: pesoSecagemSchema.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.pesoSecagem && !["NAO_INFORMAR", "REGISTRAR", "VINCULAR"].includes(v.pesoSecagem.acao)) ctx.addIssue({ code: "custom", path: ["pesoSecagem"], message: "Encerramento admite não informar, registrar ou reutilizar pesagem" });
  if (v.pesoSecagem && v.pesoSecagem.acao !== "NAO_INFORMAR" && !v.chave) ctx.addIssue({ code: "custom", path: ["chave"], message: "Peso na secagem exige chave de reenvio" });
});
export const manterPesoSecagemSchema = z.object({ chave: uuid, propriedadeId: z.number().int().positive(), motivo,
  versaoEsperada: z.number().int().positive().optional(), pesoSecagem: pesoSecagemSchema }).strict();
export type PesoSecagemInput = z.infer<typeof pesoSecagemSchema>;
