import { z } from "zod";

export const paginaNutricaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
});
export const listaNutricaoSchema = paginaNutricaoSchema.extend({ loteId: z.string().uuid().optional() });
export type PaginaNutricao = z.infer<typeof paginaNutricaoSchema>;

const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v; }, "Informe uma data válida");
export const consultaFechamentosSchema = listaNutricaoSchema.extend({status:z.enum(["CONFIRMADO","ESTORNADO"]).optional(),de:dataCivil.optional(),ate:dataCivil.optional()}).refine(f=>!f.de||!f.ate||f.de<=f.ate,{message:"O início não pode ser posterior ao fim",path:["ate"]});
