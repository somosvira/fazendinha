import { z } from "zod";

const dataIso = z.coerce.date();
const valorPositivo = z.coerce.number().positive();

export const contaSchema = z.object({
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
  nome: z.string().trim().min(2).max(120),
  documento: z.string().trim().max(30).optional().nullable(),
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS", "FUNCIONARIO", "PROPRIETARIO", "OUTRO"]),
  telefone: z.string().trim().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

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
  descricao: z.string().trim().max(240).optional(),
  parceiroId: z.number().int().positive().optional(),
  categoriaId: z.number().int().positive().optional(),
  centroCustoId: z.number().int().positive().optional(),
  propriedadeId: z.number().int().positive().optional(),
  itens: z.array(itemOperacaoSchema).min(1),
  financeiro: z.discriminatedUnion("condicao", [
    z.object({ condicao: z.literal("SEM_EFEITO_FINANCEIRO") }),
    z.object({ condicao: z.literal("A_VISTA"), contaId: z.number().int().positive(), formaPagamento: formaPagamentoSchema.optional() }),
    z.object({ condicao: z.literal("A_PRAZO"), parcelas: z.array(parcelaSchema).min(1) }),
    z.object({
      condicao: z.literal("PARCIAL"), contaId: z.number().int().positive(), valorPago: valorPositivo,
      formaPagamento: formaPagamentoSchema.optional(), parcelas: z.array(parcelaSchema).min(1),
    }),
  ]),
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
