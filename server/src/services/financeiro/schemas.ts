import { z } from "zod";

const dataIso = z.coerce.date();
const valorPositivo = z.coerce.number().positive();

export function documentoFiscalValido(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  if (![11, 14].includes(digitos.length) || /^(\d)\1+$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (digitos.length === 11) {
    const primeiro = calcularDigito(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = calcularDigito(`${digitos.slice(0, 9)}${primeiro}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digitos.endsWith(`${primeiro}${segundo}`);
  }

  const primeiro = calcularDigito(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(`${digitos.slice(0, 12)}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos.endsWith(`${primeiro}${segundo}`);
}

const textoOpcional = (maximo: number) => z.preprocess(
  (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor,
  z.string().trim().max(maximo).nullable().optional(),
);

const documentoSchema = textoOpcional(30).refine(
  (valor) => !valor || documentoFiscalValido(valor),
  "Informe um CPF ou CNPJ válido",
);

const emailSchema = z.preprocess(
  (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor,
  z.string().trim().email("Informe um e-mail válido").max(120).nullable().optional(),
);

export const contaSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  tipo: z.enum(["BANCO", "CAIXA", "APLICACAO", "DINHEIRO"]),
  instituicao: z.string().trim().max(100).optional().nullable(),
  identificacao: z.string().trim().max(100).optional().nullable(),
  saldoAbertura: z.coerce.number().default(0),
  dataSaldoAbertura: dataIso,
  incluirNoSaldoGeral: z.boolean().default(true),
  ativo: z.boolean().default(true),
  propriedadeId: z.number().int().positive().optional(),
});

export const parceiroSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  documento: documentoSchema,
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]),
  telefone: textoOpcional(30),
  email: emailSchema,
  ativo: z.boolean().default(true),
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
