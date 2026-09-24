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
  sexo: z.enum(["F", "M"]).optional(),
  dataNascimento: dataISO.optional(),
  nascimentoEstimado: z.boolean().optional(),
  origem: z.enum(["NASCIDO", "COMPRADO"]).optional(),
  dataEntrada: dataISO.optional(),
  partosAntesDaEntrada: z.number().int().min(0).optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;

export const substituirComposicaoSchema = z.object({
  itens: z.array(composicaoItemSchema),
});
export type SubstituirComposicaoInput = z.infer<typeof substituirComposicaoSchema>;

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

export const tipoBaixaSchema = z.enum(["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO", "CADASTRO_INDEVIDO"]);
export const classeMotivoBaixaSchema = z.enum(["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO", "MORTE"]);

export const baixaSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataISO,
  tipo: tipoBaixaSchema,
  motivoId: z.string().uuid().nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type BaixaInput = z.infer<typeof baixaSchema>;

export const estornoBaixaSchema = z.object({
  motivo: z.string().trim().min(1).max(300),
});
export type EstornoBaixaInput = z.infer<typeof estornoBaixaSchema>;

export const desfazerMovimentacaoSchema = z.object({
  motivo: z.string().trim().min(1).max(300),
});
export type DesfazerMovimentacaoInput = z.infer<typeof desfazerMovimentacaoSchema>;

export const listarMovimentacoesSchema = z.object({
  loteId: z.string().uuid().optional(),
  propriedadeId: z.coerce.number().int().positive().optional(),
  dataDe: z.string().date().optional(),
  dataAte: z.string().date().optional(),
  incluirDesfeitas: z.enum(["true", "false"]).optional().default("true").transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ListarMovimentacoesInput = z.infer<typeof listarMovimentacoesSchema>;

export const paginaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
});

export const pesagemSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataISO,
  pesoKg: z.number().positive().max(9999.99),
  tipo: z.enum(["NASCIMENTO", "ENTRADA", "DESMAMA", "ROTINA", "SAIDA"]),
  origem: z.enum(["MANUAL", "BALANCA"]).optional().default("MANUAL"),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type PesagemInput = z.infer<typeof pesagemSchema>;

export const editarPesagemSchema = z.object({
  data: dataISO.optional(),
  pesoKg: z.number().positive().max(9999.99).optional(),
  tipo: z.enum(["NASCIMENTO", "ENTRADA", "DESMAMA", "ROTINA", "SAIDA"]).optional(),
  origem: z.enum(["MANUAL", "BALANCA"]).optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarPesagemInput = z.infer<typeof editarPesagemSchema>;

export const listarFiltrosSchema = z.object({
  propriedadeId: z.coerce.number().int().positive().optional(),
  loteId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]).optional(),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional(),
  situacao: z.enum(["ATIVO", "BAIXADO", "TODOS"]).optional().default("ATIVO"),
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

/** Query comum a listagens de cadastro (lotes, raças, motivos de baixa) com "mostrar inativos". */
export const incluirInativosQuerySchema = z.object({
  incluirInativos: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
});
export type IncluirInativosQuery = z.infer<typeof incluirInativosQuerySchema>;

const siglaRaca = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2,3}$/.test(v), "Sigla deve ter 2 ou 3 letras maiúsculas");

export const criarRacaSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  sigla: siglaRaca,
  base: z.boolean().optional().default(true),
});
export type CriarRacaInput = z.infer<typeof criarRacaSchema>;

export const editarRacaSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  sigla: siglaRaca.optional(),
  base: z.boolean().optional(),
  ativo: z.boolean().optional(),
});
export type EditarRacaInput = z.infer<typeof editarRacaSchema>;

export const criarMotivoBaixaSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  classe: classeMotivoBaixaSchema,
});
export type CriarMotivoBaixaInput = z.infer<typeof criarMotivoBaixaSchema>;

export const editarMotivoBaixaSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  classe: classeMotivoBaixaSchema.optional(),
  ativo: z.boolean().optional(),
});
export type EditarMotivoBaixaInput = z.infer<typeof editarMotivoBaixaSchema>;

// ---------- categorias configuráveis ----------

const sexoBovino = z.enum(["F", "M"]);
const criterioPartos = z.enum(["QUALQUER", "SEM", "COM"]);
const meses = z.number().int().min(0).max(600);

export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  sexo: sexoBovino,
  automatica: z.boolean().optional().default(true),
  idadeMinMeses: meses.nullable().optional(),
  idadeMaxMeses: meses.nullable().optional(),
  partos: criterioPartos.optional().default("QUALQUER"),
  ordem: z.number().int().optional(),
});
export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;

export const editarCategoriaSchema = z.object({
  nome: z.string().trim().min(1).max(60).optional(),
  sexo: sexoBovino.optional(),
  automatica: z.boolean().optional(),
  idadeMinMeses: meses.nullable().optional(),
  idadeMaxMeses: meses.nullable().optional(),
  partos: criterioPartos.optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});
export type EditarCategoriaInput = z.infer<typeof editarCategoriaSchema>;

/** Uma regra na simulação: a lista inteira como ficaria (id ausente = categoria nova). */
export const regraPropostaSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1).max(60),
  sexo: sexoBovino,
  automatica: z.boolean(),
  ativo: z.boolean(),
  ordem: z.number().int(),
  idadeMinMeses: meses.nullable().optional(),
  idadeMaxMeses: meses.nullable().optional(),
  partos: criterioPartos,
});
export type RegraPropostaInput = z.infer<typeof regraPropostaSchema>;

export const simularCategoriasSchema = z.object({ regras: z.array(regraPropostaSchema).max(200) });
export const reordenarCategoriasSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });
export const restaurarPadroesSchema = z.object({ simular: z.boolean().optional().default(false) });

export const categoriaManualSchema = z.object({
  categoriaId: z.string().uuid(),
  data: z.string().date(),
  motivo: z.string().trim().min(1).max(300),
});
export type CategoriaManualInput = z.infer<typeof categoriaManualSchema>;

export const removerCategoriaManualSchema = z.object({
  motivo: z.string().trim().min(1).max(300),
});
export type RemoverCategoriaManualInput = z.infer<typeof removerCategoriaManualSchema>;

