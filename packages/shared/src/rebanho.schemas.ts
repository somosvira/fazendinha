import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

// Rebanho > Sanidade (evento sanitário) ────────────────────────────────────
const comumSanidade = { data: isoDate, observacao: z.string().max(200).optional() };
// Aplicações e vacinas sempre representam consumo: produto e quantidade são obrigatórios.
const estoqueSanidade = { produtoId: z.number().int().positive(), quantidadeUsada: z.number().positive() };

export const criarEventoSanitarioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("OCORRENCIA"), ...comumSanidade, doenca: z.string().min(1).max(60), dtFim: isoDate.optional(), diasTratamento: z.number().int().min(0).optional() }),
  z.object({ tipo: z.literal("APLICACAO"), ...comumSanidade, ...estoqueSanidade, produto: z.string().min(1).max(60), dose: z.string().max(20).optional(), carencia: z.number().int().min(0).optional(), loteProduto: z.string().max(40).optional() }),
  // gordura/proteina são Decimal(4,2) → cap em 99.99; CCS em mil/mL — cap em 9999 (limite prático muito acima do normal)
  z.object({ tipo: z.literal("EXAME"), ...comumSanidade, ccs: z.number().int().min(0).max(9999, "CCS muito alto"), gordura: z.number().min(0).max(99.99, "% gordura deve ser menor que 100").optional(), proteina: z.number().min(0).max(99.99, "% proteína deve ser menor que 100").optional() }),
  z.object({ tipo: z.literal("MASTITE"), ...comumSanidade, quarto: z.string().max(4).optional(), severidade: z.string().max(20).optional(), resultadoCultivo: z.string().max(60).optional() }),
  z.object({ tipo: z.literal("VACINA"), ...comumSanidade, ...estoqueSanidade, produto: z.string().min(1).max(60) }),
]);
export type CriarEventoSanitarioInput = z.infer<typeof criarEventoSanitarioSchema>;

// Rebanho > Exame de quarto (CMT — saúde do úbere) ─────────────────────────
export const QUARTOS = ["AE", "AD", "PE", "PD"] as const;
export const SCORES_CMT = ["NEGATIVO", "TRACOS", "UMA_CRUZ", "DUAS_CRUZES", "TRES_CRUZES"] as const;

const quartoSchema = z.object({
  quarto: z.enum(QUARTOS), scoreCmt: z.enum(SCORES_CMT).optional(), ccs: z.number().int().min(0).max(9999).optional(),
  clinica: z.boolean().optional(), severidade: z.string().max(20).optional(), resultadoCultivo: z.string().max(60).optional(),
  perdido: z.boolean().optional(), escoreTeto: z.number().int().min(1).max(4).optional(), observacao: z.string().max(200).optional(),
});
export const registrarExameQuartoSchema = z.object({ data: isoDate, quartos: z.array(quartoSchema).min(1).max(4) })
  .refine((v) => new Set(v.quartos.map((q) => q.quarto)).size === v.quartos.length, { message: "quarto repetido na mesma passada", path: ["quartos"] });
export type RegistrarExameQuartoInput = z.infer<typeof registrarExameQuartoSchema>;

// Rebanho > Produção (controle leiteiro, modo ORDENHA) ─────────────────────
const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");
const litrosPorOrdenha = z.number().positive().max(9999.99, "valor deve ser menor que 10.000 L");

export const controleSchema = z.object({
  data: dataNaoFutura, peso1: litrosPorOrdenha.optional(), peso2: litrosPorOrdenha.optional(), peso3: litrosPorOrdenha.optional(),
  pesoTotal: litrosPorOrdenha.optional(), observacao: z.string().max(200).optional(),
}).refine((v) => (v.peso1 ?? v.peso2 ?? v.peso3 ?? v.pesoTotal) != null, "informe ao menos um peso");
export type ControleInput = z.infer<typeof controleSchema>;
