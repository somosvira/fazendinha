import { z } from "zod";
import { parcelaOrdenhaSchema } from "../leite/tanques.schemas.js";
import { dataLeiteSchema } from "../leite/schemas.js";
import { observacoesExameSchema } from "../exames/formatos.js";

const uuid = z.string().uuid();
const volume = z.number().finite().positive().max(9999999.999).multipleOf(0.001);
const base = { chave: uuid, propriedadeId: z.number().int().positive() };
const versao = z.number().int().positive();
const horario = { ocorridoEm: z.string().datetime({ offset: true }).nullish(), horarioEstimado: z.boolean().default(false) };
const responsavel = z.string().trim().min(1).max(160);
const observacao = z.string().trim().max(1000).nullish();
export const retiradaColostroSchema = z.object({
  ...base, partoId: uuid, data: dataLeiteSchema, ...horario, primeiraRetirada: z.boolean(), quantidadeLitros: volume,
  producao: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("EXISTENTE"), medicaoGeralId: uuid.optional(), entradaId: uuid.optional(), versaoEsperada: versao }).strict(),
    z.object({ tipo: z.literal("NOVA"), posicaoId: uuid, parcela: parcelaOrdenhaSchema }).strict(),
  ]), responsavel, observacao,
}).strict().superRefine((v, ctx) => {
  if (v.producao.tipo === "EXISTENTE" && !v.producao.medicaoGeralId && !v.producao.entradaId)
    ctx.addIssue({ code: "custom", path: ["producao"], message: "Identifique a produção existente" });
});
export const confirmarRetiradaColostroSchema = z.object({ ...base, versaoEsperada: versao, produtoId: uuid.optional(), motivoNatureza: z.string().trim().min(5).max(500) }).strict();
export const brixColostroSchema = z.object({
  ...base, versaoEsperada: versao, data: dataLeiteSchema, tipoExameId: uuid,
  formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/), campoBrix: z.string().regex(/^[A-Z][A-Z0-9_]{0,59}$/),
  resultados: observacoesExameSchema, responsavel, anotacaoOriginal: z.string().trim().max(4000).nullish(),
}).strict();
export const destinacaoColostroSchema = z.object({
  ...base, versaoEsperada: versao, data: dataLeiteSchema, ...horario,
  crias: z.array(z.object({ criaId: uuid, quantidadeLitros: volume,
    fornecimentoColostroId: uuid.optional(), tipo: z.enum(["FRESCO", "DESCONGELADO"]).default("FRESCO"),
    forma: z.enum(["BALDE", "BALDE_COM_BICO", "MAE", "MAMADEIRA", "SONDA"]).nullish(),
  }).strict()).max(100).default([]),
  unidades: z.array(z.object({ codigo: z.string().trim().min(1).max(100) }).strict()).max(500).default([]),
  unidadeId: uuid.optional(), responsavel, observacao,
  excecaoBrix: z.object({ motivo: z.string().trim().min(5).max(1000), responsavel }).strict().optional(),
}).strict().superRefine((v, ctx) => {
  if (!v.crias.length && !v.unidades.length) ctx.addIssue({ code: "custom", path: ["crias"], message: "Informe cria, banco ou ambos" });
  if (new Set(v.unidades.map(u => u.codigo)).size !== v.unidades.length) ctx.addIssue({ code: "custom", path: ["unidades"], message: "Cada unidade deve ter código próprio" });
  if (new Set(v.crias.map(c => c.criaId)).size !== v.crias.length) ctx.addIssue({ code: "custom", path: ["crias"], message: "Consolide o volume de cada cria nesta destinação" });
  if (v.unidadeId && (v.unidades.length || !v.crias.length)) ctx.addIssue({ code: "custom", path: ["unidadeId"], message: "Destine a unidade a crias; seu remanescente continua na embalagem retirada, sem recongelamento" });
});
export const enriquecimentoColostroSchema = z.object({
  ...base, data: dataLeiteSchema, ...horario, volumeFinalLitros: volume, responsavel, observacao,
  origens: z.array(z.object({ origemId: uuid, versaoEsperada: versao, unidadeId: uuid.optional(), quantidadeLitros: volume }).strict()).min(1).max(100),
  insumos: z.array(z.object({ produtoId: uuid, partidaId: uuid.nullish(), quantidade: volume, unidade: z.enum(["UN", "KG", "G", "T", "L", "ML", "SC", "DOSE", "CX", "M", "HA"]),
    cienciaValidadeDesconhecida: z.boolean().default(false), documentacaoExcepcional: z.boolean().default(false), motivoDocumentacaoExcepcional: observacao,
  }).strict()).min(1).max(100),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.origens.map(o => `${o.origemId}:${o.unidadeId ?? "LIVRE"}`)).size !== v.origens.length) ctx.addIssue({ code: "custom", path: ["origens"], message: "Informe cada origem livre ou embalagem uma vez" });
});
export const estornoColostroSchema = z.object({ ...base, versaoEsperada: versao, motivo: z.string().trim().min(5).max(1000) }).strict();
export const consultaColostroSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1), tamanho: z.coerce.number().int().min(1).max(100).default(30),
  partoId: uuid.optional(), matrizId: uuid.optional(), criaId: uuid.optional(),
  inicio: dataLeiteSchema.optional(), fim: dataLeiteSchema.optional(), incluirEstornados: z.boolean().default(false),
  tipo: z.enum(["ENRIQUECIDO", "NAO_ENRIQUECIDO"]).optional(),
}).strict().refine(v => !v.inicio || !v.fim || v.inicio <= v.fim, { path: ["fim"], message: "Fim anterior ao início" });
export type RetiradaColostroInput = z.infer<typeof retiradaColostroSchema>;
export type ConfirmarRetiradaColostroInput = z.infer<typeof confirmarRetiradaColostroSchema>;
export type BrixColostroInput = z.infer<typeof brixColostroSchema>;
export type DestinacaoColostroInput = z.infer<typeof destinacaoColostroSchema>;
export type EnriquecimentoColostroInput = z.infer<typeof enriquecimentoColostroSchema>;
export type EstornoColostroInput = z.infer<typeof estornoColostroSchema>;
export type ConsultaColostro = z.infer<typeof consultaColostroSchema>;
export interface OpcoesColostroDTO { verValores: boolean }
