import { z } from "zod";
const data = z.string().date().refine(d => d <= new Date().toISOString().slice(0,10), "A data não pode ser futura");
export const consultaValorizacaoSchema = z.object({ data: data.optional(), propriedadeId: z.coerce.number().int().positive().max(2147483647).optional() });
export const aberturaValorizacaoSchema = z.object({
  chave: z.string().uuid(), propriedadeId: z.number().int().positive().max(2147483647).optional(), data,
  revisao: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(500), evidencia: z.string().trim().min(5).max(2000),
  bases: z.array(z.object({ partidaId: z.string().uuid().nullish(), quantidade: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/).refine(v => Number(v)>0, "Informe quantidade positiva"),
    valor: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe valor comprovado, inclusive zero"), disponivelDesde: data.optional(), referencia: z.string().trim().min(2).max(200) }).strict()).min(1).max(100),
}).strict();
