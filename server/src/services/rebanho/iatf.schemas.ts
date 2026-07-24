import { z } from "zod";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const etapaSchema = z.object({
  dia: z.number().int().min(0, "o dia (offset a partir do D0) não pode ser negativo").max(365),
  acao: z.string().min(1, "descreva a ação da etapa").max(200),
  hormonio: z.string().max(80).optional(),
  ordem: z.number().int().min(0).max(99).optional(), // desempate no mesmo dia; default = índice
});
export type EtapaInput = z.infer<typeof etapaSchema>;

export const criarProtocoloSchema = z.object({
  nome: z.string().min(1, "informe o nome do protocolo").max(120),
  descricao: z.string().max(500).optional(),
  hormonioBase: z.string().max(80).optional(),
  ativo: z.boolean().optional(),
  etapas: z.array(etapaSchema).min(1, "o protocolo precisa de ao menos uma etapa").max(20),
});
export type CriarProtocoloInput = z.infer<typeof criarProtocoloSchema>;

// PATCH parcial: metadados do protocolo e/ou a lista de etapas (substitui todas
// quando presente). Nada obrigatório — só o que veio é alterado.
export const atualizarProtocoloSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  descricao: z.string().max(500).nullable().optional(),
  hormonioBase: z.string().max(80).nullable().optional(),
  ativo: z.boolean().optional(),
  etapas: z.array(etapaSchema).min(1).max(20).optional(),
});
export type AtualizarProtocoloInput = z.infer<typeof atualizarProtocoloSchema>;

export const aplicarProtocoloSchema = z.object({
  protocoloId: z.number().int().positive(),
  dataInicio: dataISO,
  observacao: z.string().max(500).optional(),
  usoCidr: z.boolean().optional(),
  estimulo: z.string().max(80).optional(),
  perdaImplante: z.boolean().optional(),
});
export type AplicarProtocoloInput = z.infer<typeof aplicarProtocoloSchema>;

export const executarEtapaSchema = z.object({
  status: z.enum(["CONCLUIDA", "PULADA", "PENDENTE"]),
  dataExecucao: dataISO.optional(), // default = hoje (UTC) quando CONCLUIDA/PULADA
  produto: z.string().max(120).nullable().optional(),
  dose: z.string().max(40).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
});
export type ExecutarEtapaInput = z.infer<typeof executarEtapaSchema>;
