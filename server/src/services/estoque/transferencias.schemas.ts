import { z } from "zod";

export const motivoPerdaSchema = z.string({ required_error: "Informe o motivo da perda", invalid_type_error: "Informe o motivo da perda" })
  .trim().min(5, "Descreva o motivo da perda com ao menos 5 caracteres").max(200, "O motivo da perda aceita até 200 caracteres");

const campos = {
  chave: z.string().uuid("Reabra o formulário para confirmar"),
  produtoId: z.string().uuid("Selecione um Produto"),
  origemId: z.number().int().positive("Selecione o sítio de origem"),
  quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/, "Informe uma quantidade positiva com até 3 casas decimais"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida"),
  partidas: z.array(z.object({ partidaId: z.string().uuid("Selecione um lote do Produto"), quantidade: z.number().positive("Informe a quantidade do lote"), cienciaValidadeDesconhecida: z.boolean().optional() })).optional(),
};
export const perdaEstoqueSchema = z.object({ ...campos, motivo: motivoPerdaSchema }).strict();
export const transferenciaEstoqueSchema = z.object({ ...campos, destinoId: z.number().int().positive("Selecione o sítio de destino"), motivo: z.string().trim().min(5, "Descreva o motivo com ao menos 5 caracteres").max(200, "O motivo aceita até 200 caracteres") }).strict();
