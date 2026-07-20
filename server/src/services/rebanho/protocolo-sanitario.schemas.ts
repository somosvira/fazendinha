import { z } from "zod";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

// Uma etapa do protocolo sanitário: o que fazer no dia `dia` (offset a partir do D0).
export const etapaSanitariaSchema = z.object({
  dia: z.number().int().min(0, "o dia (offset a partir do D0) não pode ser negativo").max(365),
  acao: z.string().min(1, "descreva a ação da etapa").max(200),
  produto: z.string().max(80).optional(),
  ordem: z.number().int().min(0).max(99).optional(),
});
export type EtapaSanitariaInput = z.infer<typeof etapaSanitariaSchema>;

export const criarProtocoloSanitarioSchema = z.object({
  nome: z.string().min(1, "informe o nome do protocolo").max(120),
  descricao: z.string().max(500).optional(),
  ativo: z.boolean().optional(),
  etapas: z.array(etapaSanitariaSchema).min(1, "o protocolo precisa de ao menos uma etapa").max(30),
});
export type CriarProtocoloSanitarioInput = z.infer<typeof criarProtocoloSanitarioSchema>;

export const atualizarProtocoloSanitarioSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  descricao: z.string().max(500).nullable().optional(),
  ativo: z.boolean().optional(),
  etapas: z.array(etapaSanitariaSchema).min(1).max(30).optional(),
});
export type AtualizarProtocoloSanitarioInput = z.infer<typeof atualizarProtocoloSanitarioSchema>;

export const aplicarProtocoloSanitarioSchema = z.object({
  protocoloId: z.number().int().positive(),
  dataInicio: dataISO,
  observacao: z.string().max(500).optional(),
});
export type AplicarProtocoloSanitarioInput = z.infer<typeof aplicarProtocoloSanitarioSchema>;
