import { z } from "zod";

const dataIso = z.coerce.date();
// Mensagens em português: estas chegam direto ao usuário (o primeiro issue do
// zod vira o `error` da resposta 422), então o texto padrão em inglês
// ("Number must be greater than 0") não pode vazar para a tela.
const valorPositivo = z.coerce.number({ invalid_type_error: "Informe um valor numérico válido" }).positive("Informe um valor maior que zero");
const saldoAberturaSchema = z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().finite().min(-999999999999.99).max(999999999999.99));
const dataAberturaSchema = z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date());

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

const tipoContaSchema = z.enum(["BANCO", "CAIXA", "APLICACAO"]);
const tipoParceiroSchema = z.enum(["CLIENTE", "FORNECEDOR", "AMBOS", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]);

export const formaPagamentoSchema = z.enum([
  "PIX", "TRANSFERENCIA_BANCARIA", "BOLETO", "DINHEIRO", "CARTAO", "CHEQUE", "DEBITO_AUTOMATICO", "OUTRO",
]);
const camposConta = {
  tipoBancario: z.enum(["CORRENTE", "POUPANCA", "PAGAMENTO"]).nullable().optional(),
  agencia: textoOpcional(20), numeroConta: textoOpcional(30), digito: textoOpcional(5),
  titular: textoOpcional(120), local: textoOpcional(120), responsavel: textoOpcional(120),
  observacoes: textoOpcional(1000), ordem: z.number().int().min(0).max(9999).optional(),
};
const camposParceiro = {
  papeis: z.array(z.enum(["CLIENTE", "FORNECEDOR", "PRESTADOR_SERVICO", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]))
    .min(1, "Selecione pelo menos um papel").max(6).refine((p) => new Set(p).size === p.length, "Papéis repetidos").optional(),
  nomeFantasia: textoOpcional(120), pessoaContato: textoOpcional(120),
  telefoneWhatsapp: z.boolean().optional(),
  cep: z.preprocess((v) => typeof v === "string" ? v.replace(/\D/g, "") || null : v, z.string().regex(/^\d{8}$/, "Informe um CEP com 8 dígitos").nullable().optional()),
  logradouro: textoOpcional(160), numero: textoOpcional(20), complemento: textoOpcional(100),
  bairro: textoOpcional(100), cidade: textoOpcional(100),
  uf: z.preprocess((v) => typeof v === "string" ? v.trim().toUpperCase() || null : v, z.enum(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]).nullable().optional()),
  referencia: textoOpcional(240), observacoes: textoOpcional(1000),
  formaPagamentoPreferida: formaPagamentoSchema.nullable().optional(),
  condicaoPagamentoPreferida: z.enum(["A_VISTA", "A_PRAZO"]).nullable().optional(),
  prazosPagamento: z.array(z.number().int().min(1).max(3650)).max(24).refine((dias) => dias.every((dia, i) => i === 0 || dia > dias[i - 1]), "Informe prazos em ordem crescente, sem repetições").optional(),
};

export const contaSchema = z.object({
  ...camposConta,
  nome: z.string().trim().min(2).max(80),
  tipo: tipoContaSchema,
  instituicao: textoOpcional(100),
  identificacao: textoOpcional(100),
  saldoAbertura: saldoAberturaSchema,
  dataSaldoAbertura: dataAberturaSchema,
  incluirNoSaldoGeral: z.boolean().default(true),
  propriedadeId: z.number().int().positive().optional(),
});

/* PATCH declarado campo a campo (sem defaults) para que um PATCH só de `ativo`
 * nunca reaplique saldoAbertura=0 / incluirNoSaldoGeral=true. */
export const patchContaSchema = z.object({
  ...camposConta,
  nome: z.string().trim().min(2).max(80).optional(),
  tipo: tipoContaSchema.optional(),
  instituicao: textoOpcional(100),
  identificacao: textoOpcional(100),
  saldoAbertura: saldoAberturaSchema.optional(),
  dataSaldoAbertura: dataAberturaSchema.optional(),
  incluirNoSaldoGeral: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export const categoriaCadastroSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable().default(null),
  ordem: z.number().int().min(0).max(9999).default(0),
});

export const patchCategoriaCadastroSchema = categoriaCadastroSchema.partial().extend({ ativo: z.boolean().optional() });

export const centroCustoSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  ordem: z.number().int().min(0).max(9999).default(0),
});

export const patchCentroCustoSchema = centroCustoSchema.partial().extend({ ativo: z.boolean().optional() });

export const parceiroSchema = z.object({
  ...camposParceiro,
  nome: z.string().trim().min(2).max(120),
  documento: documentoSchema,
  tipo: tipoParceiroSchema.optional(),
  telefone: textoOpcional(30),
  email: emailSchema,
}).refine((p) => p.papeis !== undefined || p.tipo !== undefined, { message: "Selecione pelo menos um papel", path: ["papeis"] });

export const patchParceiroSchema = z.object({
  ...camposParceiro,
  nome: z.string().trim().min(2).max(120).optional(),
  documento: documentoSchema,
  tipo: tipoParceiroSchema.optional(),
  telefone: textoOpcional(30),
  email: emailSchema,
  ativo: z.boolean().optional(),
});

export const tipoDocumentoFinanceiroSchema = z.enum([
  "NOTA_FISCAL", "BOLETO", "CONTRATO", "RECIBO", "COMPROVANTE", "JUSTIFICATIVA", "OUTRO",
]);

export const itemOperacaoSchema = z.object({
  categoriaId: z.number().int().positive().nullable().optional(),
  classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable().optional(),
  produtoId: z.number().int().positive().optional(),
  descricao: z.string().trim().min(1).max(160),
  quantidade: valorPositivo,
  unidade: z.string().trim().min(1).max(20),
  valorUnitario: z.coerce.number().nonnegative().optional(),
  valorTotal: z.coerce.number().positive().optional(),
  estocavel: z.boolean().default(false),
}).refine((item) => item.valorUnitario !== undefined || item.valorTotal !== undefined, { message: "Informe o valor unitário ou total do item", path: ["valorUnitario"] });

const parcelaSchema = z.object({
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

export const operacaoSchema = z.object({
  classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable().optional(),
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
