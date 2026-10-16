import { z } from "zod";

const lista = (valor: unknown) => typeof valor === "string" ? valor.split(",").filter(Boolean) : valor;
const numeroOpcional = (valor: unknown) => typeof valor === "string" ? valor.trim() === "" ? undefined : Number(valor) : valor;
/** Corte é a data factual máxima conhecida nesta emissão; não recupera estados anteriores do banco. */
const camposConsultaIndicadores = z.object({
  propriedadeId: z.coerce.number().int().positive(),
  inicio: z.string().date(),
  fim: z.string().date(),
  corte: z.string().date(),
  concepcaoEstimada: z.preprocess(numeroOpcional, z.number().min(0).max(100).optional()),
  deslocamentoTeDias: z.preprocess(numeroOpcional, z.number().int().min(0).max(30).default(7)),
  loteId: z.string().uuid().optional(),
  tiposTentativa: z.preprocess(lista, z.array(z.enum(["IA", "TE", "COBERTURA"])).min(1).max(3)).optional(),
  papeis: z.preprocess(lista, z.array(z.enum(["NENHUM", "DOADORA", "RECEPTORA"])).min(1).max(3)).optional(),
}).strict();
const validarPeriodoIndicadores = (f: { inicio: string; fim: string; corte: string; tiposTentativa?: string[]; papeis?: string[] }, ctx: z.RefinementCtx) => {
  if (f.inicio > f.fim) ctx.addIssue({ code: "custom", path: ["fim"], message: "Fim deve ser igual ou posterior ao início" });
  if (f.corte < f.fim) ctx.addIssue({ code: "custom", path: ["corte"], message: "O corte dos resultados deve ser igual ou posterior ao fim" });
  if (f.tiposTentativa && new Set(f.tiposTentativa).size !== f.tiposTentativa.length)
    ctx.addIssue({ code: "custom", path: ["tiposTentativa"], message: "Não repita tipos de tentativa" });
  if (f.papeis && new Set(f.papeis).size !== f.papeis.length)
    ctx.addIssue({ code: "custom", path: ["papeis"], message: "Não repita papéis" });
};
export const consultaIndicadoresSchema = camposConsultaIndicadores.superRefine(validarPeriodoIndicadores);
export const filtrosIndicadoresSchema = camposConsultaIndicadores.omit({ propriedadeId: true }).superRefine(validarPeriodoIndicadores);

export const emitirIndicadoresSchema = z.object({
  chave: z.string().uuid(), filtros: consultaIndicadoresSchema,
}).strict();
export type ConsultaIndicadoresInput = z.infer<typeof consultaIndicadoresSchema>;
