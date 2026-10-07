import { z } from "zod";
const situacaoSchema = z.enum(["VALIDO", "ANULADO", "PENDENTE", "ATRASADA", "REALIZADA", "DISPENSADA", "EXECUCAO_CANCELADA", "ABERTA", "ENCERRADA", "AGUARDANDO_RESULTADO", "RESULTADO_INFORMADO", "ORIGEM_PENDENTE", "CARÊNCIA_VIGENTE", "CARÊNCIA_DESCONHECIDA"]);
const listaCsv = <T extends z.ZodTypeAny>(item: T) => z.string().transform((s) => [...new Set(s.split(",").map((v) => v.trim()).filter(Boolean))]).pipe(z.array(item).min(1).max(100)).optional();
export const consultaSanitariaSchema = z.object({
  animalId: z.string().uuid().optional(), loteId: z.string().uuid().optional(),
  animalIds: listaCsv(z.string().uuid()), loteIds: listaCsv(z.string().uuid()), situacoes: listaCsv(situacaoSchema),
  buscaAnimal: z.string().trim().max(160).optional(),
  rodadaId: z.string().uuid().optional(),
  semRodada: z.enum(["true", "false"]).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  situacao: situacaoSchema.optional(),
  pagina: z.coerce.number().int().min(1).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(50),
  paginado: z.enum(["true", "false"], { errorMap: () => ({ message: "Informe se a consulta deve ser paginada" }) }).optional(),
});
export type ConsultaSanitaria = z.infer<typeof consultaSanitariaSchema>;
export function limites(f?: ConsultaSanitaria) { return { skip: ((f?.pagina ?? 1) - 1) * (f?.porPagina ?? 100), take: f?.porPagina ?? 100 }; }
export function intervalo(f?: ConsultaSanitaria) { return { ...(f?.de ? { gte: new Date(f.de + "T00:00:00Z") } : {}), ...(f?.ate ? { lte: new Date(f.ate + "T00:00:00Z") } : {}) }; }
export const animaisSelecionados = (f?: ConsultaSanitaria) => f?.animalIds ?? (f?.animalId ? [f.animalId] : []);
export const lotesSelecionados = (f?: ConsultaSanitaria) => f?.loteIds ?? (f?.loteId ? [f.loteId] : []);
export const situacoesSelecionadas = (f?: ConsultaSanitaria) => f?.situacoes ?? (f?.situacao ? [f.situacao] : []);
export function filtrarSituacoes<T>(f: ConsultaSanitaria | undefined, montar: (s: z.infer<typeof situacaoSchema>) => T) {
  const situacoes = situacoesSelecionadas(f).map(montar);
  return situacoes.length > 1 ? { OR: situacoes } : situacoes[0] ?? {};
}
export const statusSituacao = (s: z.infer<typeof situacaoSchema>) => ({ status: s === "ANULADO" ? "ANULADO" as const : "VALIDO" as const });
export function filtrosFatos(f?: ConsultaSanitaria, campoData = "data") {
  const lotes = lotesSelecionados(f); const animais = animaisSelecionados(f);
  return { ...(f?.de || f?.ate ? { [campoData]: intervalo(f) } : {}), ...(animais.length ? { animalId: { in: animais } } : {}), ...(lotes.length || f?.buscaAnimal ? { animal: { ...buscaAnimal(f), ...(lotes.length ? { localizacoes: { some: { loteId: lotes.length === 1 ? lotes[0] : { in: lotes }, ...(f?.de ? { OR: [{ ate: null }, { ate: { gt: new Date(f.de) } }] } : {}), ...(f?.ate ? { desde: { lte: new Date(f.ate) } } : {}) } } } : {}) } } : {}) };
}
export function buscaAnimal(f?: ConsultaSanitaria) {
  return f?.buscaAnimal ? { OR: [{ brinco: { contains: f.buscaAnimal, mode: "insensitive" as const } }, { nome: { contains: f.buscaAnimal, mode: "insensitive" as const } }] } : {};
}
