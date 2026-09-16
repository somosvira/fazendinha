import { z } from "zod";
import { LIMITE_MESES, REGIMES_RELATORIO, mesesEntreDatas } from "../relatorio-gerencial.schemas.js";

// Transferência financeira só redistribui saldo entre contas próprias; não é
// uma dimensão de composição do relatório.
export const TIPOS_RELATORIO = [
  "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
  "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
] as const;
// Operações nascem CONFIRMADA (o rascunho vive em RascunhoOperacao) e só podem
// passar a CANCELADA; RASCUNHO não existe como situação de uma operação.
export const STATUS_RELATORIO = ["CONFIRMADA", "CANCELADA"] as const;
export const CLASSIFICACOES_RELATORIO = ["CUSTEIO", "INVESTIMENTO", "SEM_CLASSIFICACAO"] as const;

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida")
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida");
const unicos = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(200).default([]).transform((lista) => [...new Set(lista)] as z.infer<T>[]);
// 0 representa "Sem centro de custo" / "Sem categoria", como na análise por categoria.
const ids = unicos(z.number().int().min(0));

const campos = {
  nome: z.string().trim().max(120),
  dataInicio: z.string().max(10),
  dataFim: z.string().max(10),
  regime: z.enum(REGIMES_RELATORIO).default("ambos"),
  tipos: unicos(z.enum(TIPOS_RELATORIO)),
  status: unicos(z.enum(STATUS_RELATORIO)),
  centroCustoIds: ids,
  parceiroIds: ids,
  categoriaIds: ids,
  classificacoes: unicos(z.enum(CLASSIFICACOES_RELATORIO)),
};

/** O rascunho guarda o que o usuário estiver digitando, mesmo incompleto. */
export const rascunhoRelatorioFinanceiroSchema = z.object(campos).partial();

export const configuracaoRelatorioFinanceiroSchema = z.object({
  ...campos,
  nome: z.string().trim().min(1, "Informe um nome").max(120),
  dataInicio: dia,
  dataFim: dia,
}).superRefine((valor, ctx) => {
  if (valor.dataInicio > valor.dataFim) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataFim"], message: "A data final não pode ser anterior à inicial" });
  else if (mesesEntreDatas(valor.dataInicio, valor.dataFim) > LIMITE_MESES) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataFim"], message: `O período máximo é de ${LIMITE_MESES} meses` });
});

export type ConfiguracaoRelatorioFinanceiro = z.infer<typeof configuracaoRelatorioFinanceiroSchema>;
export type RascunhoConfiguracaoRelatorio = z.infer<typeof rascunhoRelatorioFinanceiroSchema>;
