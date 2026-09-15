import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const REGIMES_RELATORIO = ["realizado", "previsto", "ambos"] as const;
export type RegimeRelatorio = (typeof REGIMES_RELATORIO)[number];

export const LIMITE_MESES = 24;

export function mesesEntreDatas(inicio: string, fim: string): number {
  const [ai, mi] = inicio.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  return (af - ai) * 12 + (mf - mi) + 1;
}

export const relatorioGerencialQuerySchema = z.object({
  inicio: isoDate,
  fim: isoDate,
  regime: z.enum(REGIMES_RELATORIO).default("ambos"),
}).superRefine((v, ctx) => {
  if (v.inicio > v.fim) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data inicial deve ser anterior à data final", path: ["inicio"] });
  } else if (mesesEntreDatas(v.inicio, v.fim) > LIMITE_MESES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `período máximo de ${LIMITE_MESES} meses`, path: ["fim"] });
  }
});

export type RelatorioGerencialQuery = z.infer<typeof relatorioGerencialQuerySchema>;
