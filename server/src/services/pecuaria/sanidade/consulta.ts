import { z } from "zod";
export const consultaSanitariaSchema = z.object({
  animalId: z.string().uuid().optional(), loteId: z.string().uuid().optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  situacao: z.enum(["VALIDO", "ANULADO", "PENDENTE", "ATRASADA", "REALIZADA", "DISPENSADA", "EXECUCAO_CANCELADA", "ABERTA", "ENCERRADA", "AGUARDANDO_RESULTADO", "RESULTADO_INFORMADO", "ORIGEM_PENDENTE", "CARÊNCIA_VIGENTE", "CARÊNCIA_DESCONHECIDA"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(50),
});
export type ConsultaSanitaria = z.infer<typeof consultaSanitariaSchema>;
export function limites(f?: ConsultaSanitaria) { return { skip: ((f?.pagina ?? 1) - 1) * (f?.porPagina ?? 100), take: f?.porPagina ?? 100 }; }
export function intervalo(f?: ConsultaSanitaria) { return { ...(f?.de ? { gte: new Date(f.de + "T00:00:00Z") } : {}), ...(f?.ate ? { lte: new Date(f.ate + "T00:00:00Z") } : {}) }; }
export function filtrosFatos(f?: ConsultaSanitaria, campoData = "data") {
  return { ...(f?.de || f?.ate ? { [campoData]: intervalo(f) } : {}), ...(f?.situacao ? { status: f.situacao === "ANULADO" ? "ANULADO" as const : "VALIDO" as const } : {}), ...(f?.loteId ? { animal: { localizacoes: { some: { loteId: f.loteId, ...(f.de ? { OR: [{ ate: null }, { ate: { gt: new Date(f.de) } }] } : {}), ...(f.ate ? { desde: { lte: new Date(f.ate) } } : {}) } } } } : {}) };
}
