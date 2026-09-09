import { z } from "zod";

// operacaoSchema/liquidacaoSchema/transferenciaSchema (e os schemas que eles
// dependem) moraram em @rionovo/shared — o client precisa pré-validar com o
// mesmo schema antes de enfileirar uma escrita offline (ver
// docs/design/offline/PLANO_FINANCEIRO.md). O resto (contas, parceiros,
// transação avulsa, estorno, rascunho) não tem cobertura offline e
// continua só aqui.
export {
  formaPagamentoSchema, itemOperacaoSchema, operacaoSchema, liquidacaoSchema, transferenciaSchema,
  type OperacaoInput,
} from "@rionovo/shared";
import { formaPagamentoSchema } from "@rionovo/shared";

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

export const tipoDocumentoFinanceiroSchema = z.enum([
  "NOTA_FISCAL", "BOLETO", "CONTRATO", "RECIBO", "COMPROVANTE", "JUSTIFICATIVA", "OUTRO",
]);

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
