import { z } from "zod";
import { entityIdSchema } from "./ids.js";

const MAX_DECIMAL_12_2 = 9_999_999_999.99;
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const dataNaoFuturaSchema = isoDateSchema.refine((value) => new Date(value) <= new Date(), "data não pode ser futura");

export const setoresEstoqueSchema = z.enum(["LEITE", "CAFE", "CORTE", "MILHO", "GERAL"]);

export const produtoEstoqueSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().min(1).max(80),
  tipo: z.enum(["MEDICAMENTO", "RACAO", "INSUMO", "MINERAL", "OUTRO"]),
  unidade: z.string().min(1).max(12).default("un"),
  custoUnitario: z.number().nonnegative().max(MAX_DECIMAL_12_2, "custo muito alto").optional(),
  carencia: z.number().int().nonnegative().max(9999, "carência muito alta").optional(),
  percentualMS: z.number().min(0).max(100).optional(),
  estocavel: z.boolean().optional(),
  minimoEstoque: z.number().nonnegative().max(MAX_DECIMAL_12_2, "estoque mínimo muito alto").optional(),
  ativo: z.boolean().optional(),
  setor: setoresEstoqueSchema.nullable().optional(),
  categoriaId: entityIdSchema.nullable().optional(),
  centroCustoId: entityIdSchema.nullable().optional(),
});

export const fornecedorEstoqueSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().min(1).max(120),
  documento: z.string().max(20).optional(),
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS"]).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email().max(120).optional().or(z.literal("")),
  ativo: z.boolean().optional(),
});

export const movimentoEstoqueSchema = z.object({
  id: entityIdSchema.optional(),
  operacaoId: entityIdSchema.optional(),
  itemOperacaoId: entityIdSchema.optional(),
  produtoId: entityIdSchema,
  registradoEm: z.coerce.date().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  data: dataNaoFuturaSchema,
  quantidade: z.number().min(-MAX_DECIMAL_12_2, "quantidade muito alta").max(MAX_DECIMAL_12_2, "quantidade muito alta"),
  custoUnitario: z.number().nonnegative().max(MAX_DECIMAL_12_2, "custo unitário muito alto").optional(),
  grupoId: z.number().int().optional(),
  observacao: z.string().min(5, "justificativa é obrigatória").max(200),
  propriedadeId: z.number().int().optional(),
}).superRefine((value, ctx) => {
  if (value.quantidade === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
  } else if (value.tipo !== "AJUSTE" && value.quantidade < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade deve ser positiva", path: ["quantidade"] });
  }
});

export const localArmazenamentoSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().min(1).max(80),
  ativo: z.boolean().optional(),
});

export const loteProdutoSchema = z.object({
  id: entityIdSchema.optional(),
  produtoId: entityIdSchema,
  codigo: z.string().min(1, "informe o código do lote").max(60),
  validade: isoDateSchema.nullable().optional(),
  localId: entityIdSchema.nullable().optional(),
  quantidade: z.number().min(0).max(9_999_999).nullable().optional(),
});

export const composicaoRacaoSchema = z.object({
  itens: z.array(z.object({
    id: entityIdSchema.optional(),
    ingredienteId: entityIdSchema,
    proporcao: z.number().min(0).max(100),
  })).max(50),
});

export const composicaoPrincipiosAtivosSchema = z.object({
  principios: z.array(z.object({
    id: entityIdSchema.optional(),
    principioAtivoId: z.number().int().positive(),
    concentracao: z.string().max(60).optional(),
  })).max(30),
});

export const consumoPeriodoSchema = z.object({
  id: entityIdSchema.optional(),
  movimentoIds: z.array(entityIdSchema).optional(),
  dataInicio: isoDateSchema,
  dataFim: isoDateSchema,
  observacao: z.string().max(200).optional(),
});

const eventoSanitarioComum = { data: isoDateSchema, observacao: z.string().max(200).optional() };
const consumoEstoqueSanitario = {
  produtoId: entityIdSchema,
  movimentoEstoqueId: entityIdSchema.optional(),
  quantidadeUsada: z.number().positive(),
};

export const eventoSanitarioEstoqueSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("OCORRENCIA"), ...eventoSanitarioComum, doenca: z.string().min(1).max(60), dtFim: isoDateSchema.optional(), diasTratamento: z.number().int().min(0).optional() }),
  z.object({ tipo: z.literal("APLICACAO"), ...eventoSanitarioComum, ...consumoEstoqueSanitario, produto: z.string().min(1).max(60), dose: z.string().max(20).optional(), carencia: z.number().int().min(0).optional(), loteProduto: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("EXAME"), ...eventoSanitarioComum, ccs: z.number().int().min(0).max(9999, "CCS muito alto"), gordura: z.number().min(0).max(99.99, "% gordura deve ser menor que 100").optional(), proteina: z.number().min(0).max(99.99, "% proteína deve ser menor que 100").optional() }),
  z.object({ tipo: z.literal("MASTITE"), ...eventoSanitarioComum, quarto: z.string().max(4).optional(), severidade: z.string().max(20).optional(), resultadoCultivo: z.string().max(60).optional() }),
  z.object({ tipo: z.literal("VACINA"), ...eventoSanitarioComum, ...consumoEstoqueSanitario, produto: z.string().min(1).max(60) }),
]);

export type ProdutoEstoqueInput = z.infer<typeof produtoEstoqueSchema>;
export type FornecedorEstoqueInput = z.infer<typeof fornecedorEstoqueSchema>;
export type MovimentoEstoqueInput = z.infer<typeof movimentoEstoqueSchema>;
export type ConsumoPeriodoInput = z.infer<typeof consumoPeriodoSchema>;
export type EventoSanitarioEstoqueInput = z.infer<typeof eventoSanitarioEstoqueSchema>;
