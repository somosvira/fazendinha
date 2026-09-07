import { z } from "zod";
import { IDS_TEMPLATE_RELATORIO } from "./relatorios.catalogo.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const CATEGORIAS = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "TOURO", "CABRITA", "CABRA", "CABRITO", "BODE"] as const;
const HISTORICOS = new Set(["ia-periodo", "cobertura-periodo", "te-periodo", "dg-periodo", "partos-periodo", "secagens-periodo", "partos-previstos"]);
const filtroColunaSchema = z.object({
  chave: z.string().trim().min(1).max(60),
  tipo: z.enum(["texto", "numero", "data"]),
  valor: z.string().trim().max(120).optional(),
  minimo: z.union([z.string().trim().max(40), z.number()]).optional(),
  maximo: z.union([z.string().trim().max(40), z.number()]).optional(),
});

const filtrosColunasSchema = z.string().max(5000).transform((valor, ctx) => {
  try { return JSON.parse(valor); }
  catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filtros de colunas inválidos" }); return z.NEVER; }
}).pipe(z.array(filtroColunaSchema).max(50)).optional();

export const relatorioQuerySchema = z.object({
  templateId: z.enum(IDS_TEMPLATE_RELATORIO),
  dataInicio: isoDate.optional(),
  dataFim: isoDate.optional(),
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.coerce.number().int().positive().optional(),
  setor: z.string().trim().max(40).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  animal: z.string().trim().max(80).optional(),
  reprodutor: z.string().trim().max(80).optional(),
  protocolo: z.string().trim().max(80).optional(),
  resultado: z.enum(["positivo", "negativo"]).optional(),
  filtrosColunas: filtrosColunasSchema,
}).superRefine((v, ctx) => {
  if (HISTORICOS.has(v.templateId) && (!v.dataInicio || !v.dataFim)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe o período completo", path: [!v.dataInicio ? "dataInicio" : "dataFim"] });
  }
  if (v.dataInicio && v.dataFim && v.dataInicio > v.dataFim) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data inicial deve ser anterior à data final", path: ["dataInicio"] });
  }
  for (const [indice, filtro] of (Array.isArray(v.filtrosColunas) ? v.filtrosColunas : []).entries()) {
    if (filtro.tipo === "numero") {
      if (filtro.minimo !== undefined && !Number.isFinite(Number(filtro.minimo))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "limite mínimo deve ser numérico", path: ["filtrosColunas", indice, "minimo"] });
      if (filtro.maximo !== undefined && !Number.isFinite(Number(filtro.maximo))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "limite máximo deve ser numérico", path: ["filtrosColunas", indice, "maximo"] });
      if (filtro.minimo !== undefined && filtro.maximo !== undefined && Number(filtro.minimo) > Number(filtro.maximo)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "limite mínimo deve ser menor ou igual ao máximo", path: ["filtrosColunas", indice, "minimo"] });
    }
  }
});

export type RelatorioQuery = z.infer<typeof relatorioQuerySchema>;
