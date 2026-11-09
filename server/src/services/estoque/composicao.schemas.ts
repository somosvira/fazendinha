import { z } from "zod";
import { Prisma } from "@prisma/client";
export const unidadeConcentracaoSchema = z.enum(["MG_ML","MG_G","G_L","UI_ML","UI_G","PERCENTUAL_MASSA_MASSA","PERCENTUAL_MASSA_VOLUME","PERCENTUAL_VOLUME_VOLUME"]);
export const decimalCadastroSchema = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/, "Use um decimal com ponto, até 12 dígitos inteiros e seis casas decimais");
const ingredienteSchema = z.object({ principioAtivoId: z.string().uuid().transform(id => id.toLowerCase()), concentracaoValor: decimalCadastroSchema.nullable(), concentracaoUnidade: unidadeConcentracaoSchema.nullable() }).strict().superRefine((v,c) => {
  if ((v.concentracaoValor === null) !== (v.concentracaoUnidade === null)) c.addIssue({code:"custom",path:["concentracaoUnidade"],message:"Informe valor e unidade juntos"});
  if (v.concentracaoValor !== null && /^\d{1,12}(\.\d{1,6})?$/.test(v.concentracaoValor) && new Prisma.Decimal(v.concentracaoValor).lte(0)) c.addIssue({code:"custom",path:["concentracaoValor"],message:"A concentração deve ser positiva"});
  if (v.concentracaoValor !== null && /^\d{1,12}(\.\d{1,6})?$/.test(v.concentracaoValor) && v.concentracaoUnidade?.startsWith("PERCENTUAL") && new Prisma.Decimal(v.concentracaoValor).gt(100)) c.addIssue({code:"custom",path:["concentracaoValor"],message:"O percentual não pode superar 100"});
});
const versao = { situacao: z.enum(["INFORMADA","NAO_INFORMADA"]), referencia: z.string().trim().max(500).nullable(), versaoEsperada: z.string().uuid().transform(id => id.toLowerCase()).nullable(), motivoAlteracao: z.string().trim().min(5).max(500).optional() };
export const composicaoSchema = z.object({ ...versao, itens: z.array(ingredienteSchema).max(200) }).strict().superRefine((v,c) => {
  if ((v.situacao === "INFORMADA") !== (v.itens.length > 0)) c.addIssue({code:"custom",path:["itens"],message:"Composição informada exige ingredientes; não informada exige lista vazia"});
  if (new Set(v.itens.map(i=>i.principioAtivoId)).size !== v.itens.length) c.addIssue({code:"custom",path:["itens"],message:"Princípios ativos repetidos"});
  if (v.itens.some(i=>i.concentracaoValor !== null) && !v.referencia?.trim()) c.addIssue({code:"custom",path:["referencia"],message:"Informe a referência das concentrações"});
});
const nutrienteSchema = z.object({ nutrienteId: z.string().uuid().transform(id => id.toLowerCase()), valor: decimalCadastroSchema.nullable(), base: z.enum(["MATERIA_NATURAL","MATERIA_SECA","NAO_INFORMADA"]) }).strict().superRefine((v,c) => {
  if ((v.valor === null) !== (v.base === "NAO_INFORMADA")) c.addIssue({code:"custom",path:["base"],message:"Informe valor e base juntos ou deixe ambos não informados"});
});
export const informacoesNutricionaisSchema = z.object({ ...versao, itens: z.array(nutrienteSchema).max(200) }).strict().superRefine((v,c)=>{
  if ((v.situacao === "INFORMADA") !== (v.itens.length > 0)) c.addIssue({code:"custom",path:["itens"],message:"Perfil informado exige nutrientes; não informado exige lista vazia"});
  if (new Set(v.itens.map(i=>i.nutrienteId)).size !== v.itens.length) c.addIssue({code:"custom",path:["itens"],message:"Nutrientes repetidos"});
  if (v.itens.some(i=>i.valor !== null) && !v.referencia?.trim()) c.addIssue({code:"custom",path:["referencia"],message:"Informe a referência dos valores nutricionais"});
});
export type ComposicaoInput = z.infer<typeof composicaoSchema>;
export type InformacoesNutricionaisInput = z.infer<typeof informacoesNutricionaisSchema>;
