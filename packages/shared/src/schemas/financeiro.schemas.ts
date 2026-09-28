import { z } from "zod";

const dataIso = z.coerce.date();
// Mensagens em português: o primeiro issue do zod vira o `error` da resposta
// 422 e chega direto ao usuário.
const valorPositivo = z.coerce.number({ invalid_type_error: "Informe um valor numérico válido" }).positive("Informe um valor maior que zero");

export const formaPagamentoSchema = z.enum([
  "PIX", "TRANSFERENCIA_BANCARIA", "BOLETO", "DINHEIRO", "CARTAO", "CHEQUE", "DEBITO_AUTOMATICO", "OUTRO",
]);

export const itemOperacaoSchema = z.object({
  categoriaId: z.string().uuid().nullable().optional(),
  classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable().optional(),
  // undefined = herda do produto (se ele tem exatamente 1 centro), senão null;
  // null = explicitamente "herda o centro da operação".
  centroCustoId: z.string().uuid().nullable().optional(),
  produtoId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1).max(160),
  quantidade: valorPositivo,
  unidade: z.string().trim().min(1).max(20),
  valorUnitario: z.coerce.number().nonnegative().optional(),
  valorTotal: z.coerce.number().positive().optional(),
  estocavel: z.boolean().default(false),
}).refine((item) => item.valorUnitario !== undefined || item.valorTotal !== undefined, { message: "Informe o valor unitário ou total do item", path: ["valorUnitario"] });

const parcelaSchema = z.object({
  id: z.string().uuid().optional(),
  valor: z.coerce.number({ invalid_type_error: "Informe um valor numérico válido para a parcela" }).positive("Nenhuma parcela pode ficar sem valor. Informe um valor maior que zero ou remova a parcela."),
  dataVencimento: z.coerce.date({ errorMap: () => ({ message: "Informe a data de vencimento de todas as parcelas" }) }),
});

export const simulacaoParcelasSchema = z.object({
  itens: z.array(z.object({ quantidade: valorPositivo, valorUnitario: z.coerce.number().nonnegative().optional(), valorTotal: z.coerce.number().positive().optional() }).refine((item) => item.valorUnitario !== undefined || item.valorTotal !== undefined, { message: "Informe o valor unitário ou total do item" })).default([]),
  valorTotal: z.coerce.number().positive().optional(),
  valorPagoAgora: z.coerce.number().nonnegative().optional(),
  quantidadeParcelas: z.number().int().min(1).max(360),
  frequencia: z.enum(["SEMANAL", "MENSAL"]),
  primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((input, ctx) => {
  if (!input.itens.length && input.valorTotal === undefined) ctx.addIssue({ code: "custom", path: ["valorTotal"], message: "Informe itens ou o valor total" });
});

const financeiroSchema = z.discriminatedUnion("condicao", [
  z.object({ condicao: z.literal("SEM_EFEITO_FINANCEIRO") }),
  z.object({ condicao: z.literal("A_VISTA"), contaId: z.string().uuid(), formaPagamento: formaPagamentoSchema.optional() }),
  z.object({ condicao: z.literal("A_PRAZO"), parcelas: z.array(parcelaSchema).min(1) }),
  z.object({
    condicao: z.literal("PARCIAL"), contaId: z.string().uuid(), valorPago: valorPositivo,
    formaPagamento: formaPagamentoSchema.optional(), parcelas: z.array(parcelaSchema).min(1),
  }),
]);

export type Financeiro = z.infer<typeof financeiroSchema>;

/** Só A_PRAZO e PARCIAL carregam parcelas. */
export function temParcelas(f: Financeiro): f is Extract<Financeiro, { parcelas: unknown }> {
  return f.condicao === "A_PRAZO" || f.condicao === "PARCIAL";
}

export const operacaoSchema = z.object({
  id: z.string().uuid().optional(),
  classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable().optional(),
  tipo: z.enum([
    "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
    "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
  ]),
  data: dataIso,
  descricao: z.string().trim().min(2).max(240),
  valorTotal: z.coerce.number().nonnegative().optional(),
  parceiroId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  centroCustoId: z.string().uuid().optional(),
  corrigeOperacaoId: z.string().uuid().optional(),
  propriedadeId: z.number().int().positive().optional(),
  itens: z.array(itemOperacaoSchema).default([]),
  financeiro: financeiroSchema,
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
  if (temParcelas(input.financeiro)) {
    const ids = input.financeiro.parcelas.flatMap((parcela) => parcela.id ? [parcela.id] : []);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["financeiro", "parcelas"], message: "Há parcelas com o mesmo identificador" });
  }
});

export const liquidacaoSchema = z.object({
  transacaoId: z.string().uuid().optional(),
  contaId: z.string().uuid(),
  valor: valorPositivo,
  data: dataIso,
  formaPagamento: formaPagamentoSchema.optional(),
  descricao: z.string().trim().max(240).optional(),
});

export const transferenciaSchema = z.object({
  id: z.string().uuid().optional(),
  contaOrigemId: z.string().uuid(),
  contaDestinoId: z.string().uuid(),
  valor: valorPositivo,
  data: dataIso,
  descricao: z.string().trim().max(240).optional(),
  propriedadeId: z.number().int().positive().optional(),
});

// Limites das colunas Decimal(12,3) de MovimentoEstoque.
const MAX_QTD = 999_999_999.999;

export const ajusteContagemSchema = z.object({
  id: z.string().uuid().optional(),
  produtoId: z.string().uuid(),
  quantidadeContada: z.number().finite().min(0).max(MAX_QTD).multipleOf(0.001),
  saldoEsperado: z.number().finite().min(-MAX_QTD).max(MAX_QTD).multipleOf(0.001),
  observacao: z.string().trim().min(5, "justificativa é obrigatória").max(200),
  propriedadeId: z.number().int().positive().optional(),
  centroCustoId: z.string().uuid().nullable().optional(),
});

export type OperacaoValidada = z.infer<typeof operacaoSchema>;
export type ItemOperacaoValidado = z.infer<typeof itemOperacaoSchema>;
export type SimulacaoParcelasValidada = z.infer<typeof simulacaoParcelasSchema>;
export type LiquidacaoValidada = z.infer<typeof liquidacaoSchema>;
export type TransferenciaValidada = z.infer<typeof transferenciaSchema>;
export type AjusteContagemValidado = z.infer<typeof ajusteContagemSchema>;
export type FormaPagamento = z.infer<typeof formaPagamentoSchema>;
