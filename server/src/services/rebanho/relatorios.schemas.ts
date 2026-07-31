import { z } from "zod";
import { IDS_TEMPLATE_RELATORIO } from "./relatorios.catalogo.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const CATEGORIAS = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "TOURO", "CABRITA", "CABRA", "CABRITO", "BODE"] as const;
const HISTORICOS = new Set(["ia-periodo", "cobertura-periodo", "te-periodo", "dg-periodo", "partos-periodo", "secagens-periodo", "partos-previstos"]);

export const relatorioQuerySchema = z.object({
  templateId: z.enum(IDS_TEMPLATE_RELATORIO),
  dataInicio: isoDate.optional(),
  dataFim: isoDate.optional(),
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.coerce.number().int().positive().optional(),
  setor: z.string().trim().max(40).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  reprodutor: z.string().trim().max(80).optional(),
  protocolo: z.string().trim().max(80).optional(),
  resultado: z.enum(["positivo", "negativo"]).optional(),
}).superRefine((v, ctx) => {
  if (HISTORICOS.has(v.templateId) && (!v.dataInicio || !v.dataFim)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe o período completo", path: [!v.dataInicio ? "dataInicio" : "dataFim"] });
  }
  if (v.dataInicio && v.dataFim && v.dataInicio > v.dataFim) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data inicial deve ser anterior à data final", path: ["dataInicio"] });
  }
});

export type RelatorioQuery = z.infer<typeof relatorioQuerySchema>;
