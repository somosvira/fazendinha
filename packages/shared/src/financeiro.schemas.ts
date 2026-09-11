import { z } from "zod";
import { entityIdSchema } from "./ids.js";

const dataIso = z.coerce.date();
const valorPositivo = z.coerce.number().positive();

export const contaSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().trim().min(2).max(80),
  tipo: z.enum(["BANCO", "CAIXA", "APLICACAO", "DINHEIRO"]),
  instituicao: z.string().trim().max(100).optional().nullable(),
  identificacao: z.string().trim().max(100).optional().nullable(),
  saldoAbertura: z.coerce.number().default(0),
  dataSaldoAbertura: dataIso,
  incluirNoSaldoGeral: z.boolean().default(true),
  propriedadeId: z.number().int().positive().optional(),
});

export const parceiroSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().trim().min(2).max(120),
  documento: z.string().trim().max(30).optional().nullable(),
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]),
  telefone: z.string().trim().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const formaPagamentoSchema = z.enum([
  "PIX", "TRANSFERENCIA_BANCARIA", "BOLETO", "DINHEIRO", "CARTAO", "CHEQUE", "DEBITO_AUTOMATICO", "OUTRO",
]);

export const tipoDocumentoFinanceiroSchema = z.enum([
  "NOTA_FISCAL", "BOLETO", "CONTRATO", "RECIBO", "COMPROVANTE", "JUSTIFICATIVA", "OUTRO",
]);

export const itemOperacaoSchema = z.object({
  id: entityIdSchema.optional(),
  produtoId: z.number().int().positive().optional(),
  ordem: z.number().int().nonnegative().optional(),
  descricao: z.string().trim().min(1).max(160),
  quantidade: valorPositivo,
  unidade: z.string().trim().min(1).max(20),
  valorUnitario: z.coerce.number().nonnegative(),
  estocavel: z.boolean().default(false),
});

export const parcelaOperacaoSchema = z.object({
  id: entityIdSchema.optional(),
  valor: valorPositivo,
  dataVencimento: dataIso,
  numeroParcela: z.number().int().positive().optional(),
});

export const operacaoSchema = z.object({
  id: entityIdSchema.optional(),
  registradoEm: dataIso.optional(),
  tipo: z.enum([
    "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
    "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
  ]),
  data: dataIso,
  descricao: z.string().trim().min(2).max(240),
  valorTotal: z.coerce.number().nonnegative().optional(),
  parceiroId: entityIdSchema.optional(),
  categoriaId: entityIdSchema.optional(),
  centroCustoId: entityIdSchema.optional(),
  corrigeOperacaoId: entityIdSchema.optional(),
  propriedadeId: z.number().int().positive().optional(),
  itens: z.array(itemOperacaoSchema).default([]),
  financeiro: z.discriminatedUnion("condicao", [
    z.object({ condicao: z.literal("SEM_EFEITO_FINANCEIRO") }),
    z.object({
      condicao: z.literal("A_VISTA"), contaId: entityIdSchema, formaPagamento: formaPagamentoSchema.optional(),
      transacaoId: entityIdSchema.optional(), movimentoId: entityIdSchema.optional(),
    }),
    z.object({ condicao: z.literal("A_PRAZO"), parcelas: z.array(parcelaOperacaoSchema).min(1) }),
    z.object({
      condicao: z.literal("PARCIAL"), contaId: entityIdSchema, valorPago: valorPositivo,
      transacaoId: entityIdSchema.optional(), movimentoId: entityIdSchema.optional(),
      formaPagamento: formaPagamentoSchema.optional(), parcelas: z.array(parcelaOperacaoSchema).min(1),
    }),
  ]),
}).superRefine((input, ctx) => {
  const tiposComItens = new Set([
    "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "VENDA", "AJUSTE_ESTOQUE",
    "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
  ]);
  const tiposSomenteFisicos = new Set(["AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"]);
  const tiposComParceiro = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);

  if (tiposComItens.has(input.tipo) && input.itens.length === 0) {
    ctx.addIssue({ code: "custom", path: ["itens"], message: "Este tipo de operação exige ao menos um item" });
  }
  if (input.tipo === "SERVICO" && (input.valorTotal === undefined || input.valorTotal <= 0)) {
    ctx.addIssue({ code: "custom", path: ["valorTotal"], message: "Informe o valor total do serviço" });
  }
  if (tiposComParceiro.has(input.tipo) && !input.parceiroId) {
    ctx.addIssue({ code: "custom", path: ["parceiroId"], message: "Informe o parceiro desta operação" });
  }
  if (tiposSomenteFisicos.has(input.tipo) && input.financeiro.condicao !== "SEM_EFEITO_FINANCEIRO") {
    ctx.addIssue({ code: "custom", path: ["financeiro", "condicao"], message: "Este tipo de operação não gera movimentação financeira" });
  }
});

export const liquidacaoSchema = z.object({
  liquidacaoId: entityIdSchema.optional(),
  transacaoId: entityIdSchema.optional(),
  movimentoId: entityIdSchema.optional(),
  registradoEm: dataIso.optional(),
  contaId: entityIdSchema,
  valor: valorPositivo,
  data: dataIso,
  formaPagamento: formaPagamentoSchema.optional(),
  descricao: z.string().trim().max(240).optional(),
});

export const transferenciaSchema = z.object({
  operacaoId: entityIdSchema.optional(),
  transacaoId: entityIdSchema.optional(),
  movimentoOrigemId: entityIdSchema.optional(),
  movimentoDestinoId: entityIdSchema.optional(),
  registradoEm: dataIso.optional(),
  contaOrigemId: entityIdSchema,
  contaDestinoId: entityIdSchema,
  valor: valorPositivo,
  data: dataIso,
  descricao: z.string().trim().max(240).optional(),
  propriedadeId: z.number().int().positive().optional(),
});

export const transacaoAvulsaSchema = z.object({
  id: entityIdSchema.optional(),
  movimentoId: entityIdSchema.optional(),
  registradoEm: dataIso.optional(),
  tipo: z.enum(["PAGAMENTO", "RECEBIMENTO", "APORTE", "RETIRADA", "AJUSTE"]),
  contaId: entityIdSchema,
  valor: valorPositivo,
  data: dataIso,
  descricao: z.string().trim().min(2).max(240),
  parceiroId: entityIdSchema.optional(),
  formaPagamento: formaPagamentoSchema.optional(),
  propriedadeId: z.number().int().positive().optional(),
});

const movimentoEstornoSchema = z.object({ originalId: entityIdSchema, id: entityIdSchema });

export const estornoTransacaoSchema = z.object({
  motivo: z.string().trim().min(5).max(300),
  transacaoId: entityIdSchema,
  movimentos: z.array(movimentoEstornoSchema),
});

export const estornoOperacaoSchema = z.object({
  motivo: z.string().trim().min(5).max(300),
  transacoes: z.array(z.object({
    originalId: entityIdSchema,
    id: entityIdSchema,
    movimentos: z.array(movimentoEstornoSchema),
  })),
});

export const rascunhoOperacaoSchema = z.object({
  id: entityIdSchema.optional(),
  dados: z.record(z.unknown()),
  versao: z.number().int().positive().optional(),
});
