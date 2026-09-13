import { z } from "zod";

const tipos = z.enum([
  "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
  "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
]);
const status = z.enum(["RASCUNHO", "CONFIRMADA", "CANCELADA"]);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const configuracaoRelatorioFinanceiroSchema = z.object({
  nome: z.string().trim().min(1, "Informe um nome").max(120),
  dataInicio: dia,
  dataFim: dia,
  tipos: z.array(tipos).default([]),
  status: z.array(status).default([]),
  centroCustoIds: z.array(z.number().int().positive()).default([]),
}).superRefine((valor, ctx) => {
  if (valor.dataInicio > valor.dataFim) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataFim"], message: "A data final não pode ser anterior à inicial" });
});

export type ConfiguracaoRelatorioFinanceiro = z.infer<typeof configuracaoRelatorioFinanceiroSchema>;
