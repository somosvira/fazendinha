import { z } from "zod";

export const paginaNutricaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
});
const csv = <T extends z.ZodTypeAny>(item: T) => z.string().transform((s) => [...new Set(s.split(",").map((v) => v.trim()).filter(Boolean))]).pipe(z.array(item).min(1).max(100)).optional();
export const listaNutricaoSchema = paginaNutricaoSchema.extend({ loteId: z.string().uuid().optional(), loteIds: csv(z.string().uuid()),
  status: csv(z.enum(["VALIDO", "ANULADO", "CONFIRMADO", "ESTORNADO"])) });
export const resumoMensalSchema = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), loteId: z.string().uuid().optional(), loteIds: csv(z.string().uuid()) });
export type PaginaNutricao = z.infer<typeof paginaNutricaoSchema>;
export type ConsultaNutricao = z.infer<typeof listaNutricaoSchema>;
export const filtroLotesNutricao = (loteId: string | undefined, f: Partial<ConsultaNutricao>) => f.loteIds?.length ? { loteId: { in: f.loteIds } } : loteId ? { loteId } : {};
export const correcaoVigenciaSchema = z.object({ propriedadeId: z.number().int().positive(), desde: z.string().date(), dietaId: z.string().uuid().optional(), motivo: z.string().trim().min(5).max(500), revisao: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
export const anulacaoVigenciaSchema = correcaoVigenciaSchema.pick({ propriedadeId: true, motivo: true, revisao: true });
