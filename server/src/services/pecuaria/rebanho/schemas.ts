import { z } from "zod";

const dataISO = z.string().date();

export const composicaoItemSchema = z.object({
  racaId: z.string().uuid(),
  fracao64: z.number().int().min(1).max(64),
});

export const cadastrarAnimalSchema = z.object({
  brinco: z.string().trim().min(1).max(40),
  nome: z.string().trim().max(120).nullable().optional(),
  brincoEletronico: z.string().trim().max(40).nullable().optional(),
  sisbov: z.string().trim().max(40).nullable().optional(),
  sexo: z.enum(["F", "M"]),
  dataNascimento: dataISO,
  nascimentoEstimado: z.boolean().optional().default(false),
  origem: z.enum(["NASCIDO", "COMPRADO"]),
  dataEntrada: dataISO,
  partosAntesDaEntrada: z.number().int().min(0).optional().default(0),
  observacao: z.string().trim().max(500).nullable().optional(),
  propriedadeId: z.number().int().positive(),
  loteId: z.string().uuid().nullable().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional().default("NENHUM"),
  composicao: z.array(composicaoItemSchema).optional().default([]),
  pesoEntradaKg: z.number().positive().max(9999.99).nullable().optional(),
});
export type CadastrarAnimalInput = z.infer<typeof cadastrarAnimalSchema>;

export const editarAnimalSchema = z.object({
  brinco: z.string().trim().min(1).max(40).optional(),
  nome: z.string().trim().max(120).nullable().optional(),
  brincoEletronico: z.string().trim().max(40).nullable().optional(),
  sisbov: z.string().trim().max(40).nullable().optional(),
  nascimentoEstimado: z.boolean().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;

export const movimentarSchema = z.object({
  animalIds: z.array(z.string().uuid()).min(1),
  propriedadeId: z.number().int().positive(),
  loteId: z.string().uuid().nullable().optional(),
  data: dataISO,
  motivo: z.string().trim().max(300).nullable().optional(),
});
export type MovimentarInput = z.infer<typeof movimentarSchema>;

export const mudarDestinoSchema = z.object({
  animalId: z.string().uuid().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional().default("NENHUM"),
  data: dataISO,
});
export type MudarDestinoInput = z.infer<typeof mudarDestinoSchema>;

export const saidaSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataISO,
  tipo: z.enum(["VENDA", "ABATE", "MORTE", "DOACAO", "CADASTRO_INDEVIDO", "OUTRO"]),
  motivoId: z.string().uuid().nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type SaidaInput = z.infer<typeof saidaSchema>;

export const estornoSaidaSchema = z.object({
  motivo: z.string().trim().min(1).max(300),
});
export type EstornoSaidaInput = z.infer<typeof estornoSaidaSchema>;

export const pesagemSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataISO,
  pesoKg: z.number().positive().max(9999.99),
  tipo: z.enum(["NASCIMENTO", "ENTRADA", "DESMAMA", "ROTINA", "SAIDA"]),
  origem: z.enum(["MANUAL", "BALANCA"]).optional().default("MANUAL"),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type PesagemInput = z.infer<typeof pesagemSchema>;

export const listarFiltrosSchema = z.object({
  propriedadeId: z.coerce.number().int().positive().optional(),
  loteId: z.string().uuid().optional(),
  categoria: z.enum(["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "GARROTE", "TOURO"]).optional(),
  aptidao: z.enum(["LEITE", "CORTE"]).optional(),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional(),
  situacao: z.enum(["ATIVO", "SAIU", "TODOS"]).optional().default("ATIVO"),
  busca: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
});
export type ListarFiltrosInput = z.infer<typeof listarFiltrosSchema>;

export const criarLoteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  propriedadeId: z.number().int().positive(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type CriarLoteInput = z.infer<typeof criarLoteSchema>;

export const editarLoteSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  ativo: z.boolean().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarLoteInput = z.infer<typeof editarLoteSchema>;
