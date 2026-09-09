import { z } from "zod";

// Só os schemas usados por escrita offline (pré-validação no client antes de
// enfileirar) e por preverEfeitosOperacao. contaSchema/parceiroSchema/
// transacaoAvulsaSchema/estornoSchema/rascunhoOperacaoSchema ficam só no
// server — nenhuma dessas mutations tem cobertura offline (ver
// docs/design/offline/PLANO_FINANCEIRO.md).

const dataIso = z.coerce.date();
const valorPositivo = z.coerce.number().positive();

export const formaPagamentoSchema = z.enum([
  "PIX", "TRANSFERENCIA_BANCARIA", "BOLETO", "DINHEIRO", "CARTAO", "CHEQUE", "DEBITO_AUTOMATICO", "OUTRO",
]);

export const itemOperacaoSchema = z.object({
  produtoId: z.number().int().positive().optional(),
  descricao: z.string().trim().min(1).max(160),
  quantidade: valorPositivo,
  unidade: z.string().trim().min(1).max(20),
  valorUnitario: z.coerce.number().nonnegative(),
  estocavel: z.boolean().default(false),
});

const parcelaSchema = z.object({ valor: valorPositivo, dataVencimento: dataIso });

export const operacaoSchema = z.object({
  tipo: z.enum([
    "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
    "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
  ]),
  data: dataIso,
  descricao: z.string().trim().min(2).max(240),
  valorTotal: z.coerce.number().nonnegative().optional(),
  parceiroId: z.number().int().positive().optional(),
  categoriaId: z.number().int().positive().optional(),
  centroCustoId: z.number().int().positive().optional(),
  corrigeOperacaoId: z.number().int().positive().optional(),
  propriedadeId: z.number().int().positive().optional(),
  itens: z.array(itemOperacaoSchema).default([]),
  financeiro: z.discriminatedUnion("condicao", [
    z.object({ condicao: z.literal("SEM_EFEITO_FINANCEIRO") }),
    z.object({ condicao: z.literal("A_VISTA"), contaId: z.number().int().positive(), formaPagamento: formaPagamentoSchema.optional() }),
    z.object({ condicao: z.literal("A_PRAZO"), parcelas: z.array(parcelaSchema).min(1) }),
    z.object({
      condicao: z.literal("PARCIAL"), contaId: z.number().int().positive(), valorPago: valorPositivo,
      formaPagamento: formaPagamentoSchema.optional(), parcelas: z.array(parcelaSchema).min(1),
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

export type OperacaoInput = z.infer<typeof operacaoSchema>;

export const liquidacaoSchema = z.object({
  contaId: z.number().int().positive(),
  valor: valorPositivo,
  data: dataIso,
  formaPagamento: formaPagamentoSchema.optional(),
  descricao: z.string().trim().max(240).optional(),
});

export const transferenciaSchema = z.object({
  contaOrigemId: z.number().int().positive(),
  contaDestinoId: z.number().int().positive(),
  valor: valorPositivo,
  data: dataIso,
  descricao: z.string().trim().max(240).optional(),
  propriedadeId: z.number().int().positive().optional(),
});
