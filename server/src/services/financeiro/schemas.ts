import { z } from "zod";

const dataIso = z.coerce.date();
const valorPositivo = z.coerce.number().positive();

/* Texto opcional vindo de formulário: "" e espaços viram null. */
const textoOpcional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

/** Só dígitos; null quando vazio. Formato (11 = CPF, 14 = CNPJ) é validado no schema. */
export function normalizarDocumento(valor: unknown): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (typeof valor !== "string") return valor as never;
  const digitos = valor.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

const documentoSchema = z.preprocess(
  normalizarDocumento,
  z.string().refine((d) => d.length === 11 || d.length === 14, "CPF deve ter 11 dígitos e CNPJ 14").nullable().optional(),
);

const emailSchema = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().email("E-mail inválido").nullable().optional());

const tipoContaSchema = z.enum(["BANCO", "CAIXA", "APLICACAO", "DINHEIRO"]);
const tipoParceiroSchema = z.enum(["CLIENTE", "FORNECEDOR", "AMBOS", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]);

export const contaSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  tipo: tipoContaSchema,
  instituicao: textoOpcional(100),
  identificacao: textoOpcional(100),
  saldoAbertura: z.coerce.number().default(0),
  dataSaldoAbertura: dataIso,
  incluirNoSaldoGeral: z.boolean().default(true),
  propriedadeId: z.number().int().positive().optional(),
});

/* PATCH declarado campo a campo (sem defaults) para que um PATCH só de `ativo`
 * nunca reaplique saldoAbertura=0 / incluirNoSaldoGeral=true. */
export const patchContaSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  tipo: tipoContaSchema.optional(),
  instituicao: textoOpcional(100),
  identificacao: textoOpcional(100),
  saldoAbertura: z.coerce.number().optional(),
  dataSaldoAbertura: dataIso.optional(),
  incluirNoSaldoGeral: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export const parceiroSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  documento: documentoSchema,
  tipo: tipoParceiroSchema,
  telefone: textoOpcional(30),
  email: emailSchema,
});

export const patchParceiroSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  documento: documentoSchema,
  tipo: tipoParceiroSchema.optional(),
  telefone: textoOpcional(30),
  email: emailSchema,
  ativo: z.boolean().optional(),
});

export const formaPagamentoSchema = z.enum([
  "PIX", "TRANSFERENCIA_BANCARIA", "BOLETO", "DINHEIRO", "CARTAO", "CHEQUE", "DEBITO_AUTOMATICO", "OUTRO",
]);

export const tipoDocumentoFinanceiroSchema = z.enum([
  "NOTA_FISCAL", "BOLETO", "CONTRATO", "RECIBO", "COMPROVANTE", "JUSTIFICATIVA", "OUTRO",
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

export const transacaoAvulsaSchema = z.object({
  tipo: z.enum(["PAGAMENTO", "RECEBIMENTO", "APORTE", "RETIRADA", "AJUSTE"]),
  contaId: z.number().int().positive(),
  valor: valorPositivo,
  data: dataIso,
  descricao: z.string().trim().min(2).max(240),
  parceiroId: z.number().int().positive().optional(),
  formaPagamento: formaPagamentoSchema.optional(),
  propriedadeId: z.number().int().positive().optional(),
});

export const estornoSchema = z.object({ motivo: z.string().trim().min(5).max(300) });

export const rascunhoOperacaoSchema = z.object({
  dados: z.record(z.unknown()),
  versao: z.number().int().positive().optional(),
});
