import { z } from "zod";

const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// Limites compatíveis com colunas Decimal(12,2) — evita Postgres 22003 antes de chegar ao Prisma
const MAX_QTD = 9_999_999_999.99;
const MAX_CUSTO = 9_999_999_999.99;

export const movimentoSchema = z
  .object({
    produtoId: z.number().int(),
    tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
    data: naoFutura,
    quantidade: z.number().min(-MAX_QTD, "quantidade muito alta").max(MAX_QTD, "quantidade muito alta"),
    custoUnitario: z.number().nonnegative().max(MAX_CUSTO, "custo unitário muito alto").optional(),
    grupoId: z.number().int().optional(),
    fornecedorId: z.number().int().optional(),
    observacao: z.string().max(200).optional(),
    // Ponte compra→financeiro (só ENTRADA): gerar Lancamento e com qual mapeamento contábil.
    gerarLancamento: z.boolean().optional(),
    categoriaId: z.number().int().optional(),
    centroCustoId: z.number().int().optional(),
    propriedadeId: z.number().int().optional(), // sítio (multi-propriedade)
  })
  // ENTRADA/SAIDA exigem quantidade positiva; AJUSTE aceita negativa (correção de saldo) mas nunca zero.
  .superRefine((v, ctx) => {
    if (v.quantidade === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
    else if (v.tipo !== "AJUSTE" && v.quantidade < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade deve ser positiva", path: ["quantidade"] });
  });
export type MovimentoInput = z.infer<typeof movimentoSchema>;
