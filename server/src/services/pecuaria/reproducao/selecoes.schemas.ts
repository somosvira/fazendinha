import { z } from "zod";

export const camposNumericosSelecao = ["DEL", "DIAS_POS_PARTO", "DIAS_TENTATIVA", "DIAS_CONFIRMACAO", "IDADE_GESTACIONAL", "DIAS_ATE_RETORNO", "PARTOS", "TENTATIVAS_CICLO"] as const;
export const camposValoresSelecao = ["CATEGORIA", "LOTE", "SITUACAO", "PAPEL_REPRODUTIVO", "SITUACAO_PRODUTIVA", "RP", "DESCARTE", "RETORNO_INFORMADO"] as const;
const campo = z.enum([...camposNumericosSelecao, ...camposValoresSelecao]);
const faixa = z.object({
  tipo: z.literal("FAIXA"), campo: z.enum(camposNumericosSelecao),
  min: z.number().int().min(-100000).max(100000).optional(),
  max: z.number().int().min(-100000).max(100000).optional(),
  incluirMin: z.boolean().default(true), incluirMax: z.boolean().default(true),
}).strict();
export const condicaoSelecaoSchema = z.discriminatedUnion("tipo", [
  faixa,
  z.object({ tipo: z.literal("VALORES"), campo: z.enum(camposValoresSelecao),
    valores: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }).strict(),
  z.object({ tipo: z.literal("DESCONHECIDO"), campo }).strict(),
]).superRefine((c, ctx) => {
  if (c.tipo !== "FAIXA") return;
  if (c.campo !== "DIAS_ATE_RETORNO" && ((c.min != null && c.min < 0) || (c.max != null && c.max < 0))) ctx.addIssue({ code: "custom", message: "Este campo não admite dias negativos" });
  if (c.min == null && c.max == null) ctx.addIssue({ code: "custom", message: "Informe ao menos um limite da faixa" });
  if (c.min != null && c.max != null && (c.min > c.max || (c.min === c.max && (!c.incluirMin || !c.incluirMax))))
    ctx.addIssue({ code: "custom", message: "A faixa deve conter ao menos um valor", path: ["max"] });
});
export const criteriosSelecaoSchema = z.object({
  versao: z.literal(1),
  todas: z.array(condicaoSelecaoSchema).max(30),
  qualquer: z.array(z.object({ id: z.string().trim().min(1).max(80),
    todas: z.array(condicaoSelecaoSchema).min(1).max(30) }).strict()).max(20),
  ordenacao: z.array(z.object({ campo: z.enum(["BRINCO", "NOME", ...camposNumericosSelecao]),
    direcao: z.enum(["ASC", "DESC"]) }).strict()).min(1).max(5),
  politicaDesconhecidos: z.enum(["EXCLUIR", "INCLUIR"]),
}).strict().superRefine((c, ctx) => {
  if (new Set(c.qualquer.map(b => b.id)).size !== c.qualquer.length)
    ctx.addIssue({ code: "custom", path: ["qualquer"], message: "Cada bloco alternativo precisa de identificador único" });
});
export type CriteriosSelecao = z.infer<typeof criteriosSelecaoSchema>;
export type CondicaoSelecao = z.infer<typeof condicaoSelecaoSchema>;
