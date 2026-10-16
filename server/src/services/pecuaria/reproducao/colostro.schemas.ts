import { z } from "zod";
const uuid = z.string().uuid();
const texto = z.string().trim().max(1000).nullish();
const campos = {
  ocorridoEm: z.string().datetime({ offset: true }).nullish(), horarioEstimado: z.boolean().optional(),
  quantidade: z.number().positive().max(9999999999).nullish(), unidade: z.enum(["L", "ML"]).nullish(),
  metodoQualidade: z.enum(["REFRATOMETRO_BRIX", "COLOSTROMETRO"]).nullish(), qualidadeBrix: z.number().min(0).max(100).nullish(),
  qualidadeClassificacao: z.enum(["ALTA", "MEDIA", "BAIXA"]).nullish(),
  tipo: z.enum(["FRESCO", "DESCONGELADO", "PO"]).nullish(), forma: z.enum(["BALDE", "BALDE_COM_BICO", "MAE", "MAMADEIRA", "SONDA"]).nullish(),
  responsavel: z.string().trim().max(160).nullish(), observacao: texto,
};
export const fornecimentoColostroSchema = z.object({ chave: uuid, propriedadeId: z.number().int().positive(), criaId: uuid, data: z.string().date(), ...campos }).strict();
export const correcaoColostroSchema = z.object({ chave: uuid, propriedadeId: z.number().int().positive(), versaoEsperada: z.number().int().positive(), motivo: z.string().trim().min(5).max(1000), data: z.string().date().optional(), ...campos, anular: z.boolean().optional() }).strict();
export type FornecimentoColostroInput = z.infer<typeof fornecimentoColostroSchema>;
export type CorrecaoColostroInput = z.infer<typeof correcaoColostroSchema>;
