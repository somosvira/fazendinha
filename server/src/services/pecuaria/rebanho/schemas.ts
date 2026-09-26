import { z } from "zod";
import { hojeFazenda } from "./regras.js";

const dataISO = z.string().date();

/**
 * Data de um fato lançado pelo usuário (nascimento, entrada, movimentação, destino, baixa,
 * pesagem, categoria manual — R3/R6): nunca no futuro, no fuso da fazenda (`hojeFazenda()`,
 * não `new Date()`/UTC). Comparação lexicográfica: 'YYYY-MM-DD' ordena igual a Date.
 */
export const dataNaoFutura = dataISO.refine((v) => v <= hojeFazenda(), "A data não pode estar no futuro");

// Postgres Int4 (colunas `propriedadeId`/`ordem`): fora da faixa, o banco rejeita com erro cru
// em vez de uma mensagem de validação (S2).
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;
const propriedadeIdObrigatorio = z.number().int().positive().max(INT4_MAX);
const propriedadeIdOpcional = z.coerce.number().int().positive().max(INT4_MAX).optional();
const ordemInt = z.number().int().min(INT4_MIN).max(INT4_MAX);

/** Peso lançado pelo usuário (R7): mínimo 0,01 kg (evita 0,00 por arredondamento) e sempre com 2 casas. */
const pesoKgSchema = z.number().min(0.01).max(9999.99).transform((v) => Math.round(v * 100) / 100);

export const composicaoItemSchema = z.object({
  racaId: z.string().uuid(),
  fracao64: z.number().int().min(1).max(64),
});

/**
 * Filiação (v2 · Genética): cada lado (mãe/pai) aponta para um animal nosso OU um genitor
 * externo, nunca os dois — checado em `superRefine`/no service, espelhando o CHECK do banco.
 */
const filiacaoCamposSchema = z.object({
  maeId: z.string().uuid().nullable().optional(),
  paiId: z.string().uuid().nullable().optional(),
  maeExternaId: z.string().uuid().nullable().optional(),
  paiExternoId: z.string().uuid().nullable().optional(),
});
function exigirLadoUnico(f: { maeId?: string | null; maeExternaId?: string | null; paiId?: string | null; paiExternoId?: string | null }, ctx: z.RefinementCtx) {
  if (f.maeId && f.maeExternaId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maeExternaId"], message: "Escolha a mãe como animal da fazenda ou genitor externo, não os dois" });
  if (f.paiId && f.paiExternoId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paiExternoId"], message: "Escolha o pai como animal da fazenda ou genitor externo, não os dois" });
}
export const filiacaoSchema = filiacaoCamposSchema.superRefine(exigirLadoUnico);
export type FiliacaoInput = z.infer<typeof filiacaoSchema>;

export const cadastrarAnimalSchema = z.object({
  brinco: z.string().trim().min(1).max(40),
  nome: z.string().trim().max(120).nullable().optional(),
  brincoEletronico: z.string().trim().max(40).nullable().optional(),
  sisbov: z.string().trim().max(40).nullable().optional(),
  sexo: z.enum(["F", "M"]),
  dataNascimento: dataNaoFutura,
  nascimentoEstimado: z.boolean().optional().default(false),
  origem: z.enum(["NASCIDO", "COMPRADO"]),
  dataEntrada: dataNaoFutura,
  partosAntesDaEntrada: z.number().int().min(0).optional().default(0),
  observacao: z.string().trim().max(500).nullable().optional(),
  propriedadeId: propriedadeIdObrigatorio,
  loteId: z.string().uuid().nullable().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional().default("NENHUM"),
  composicao: z.array(composicaoItemSchema).optional().default([]),
  pesoEntradaKg: pesoKgSchema.nullable().optional(),
}).merge(filiacaoCamposSchema).superRefine(exigirLadoUnico);
export type CadastrarAnimalInput = z.infer<typeof cadastrarAnimalSchema>;

export const editarAnimalSchema = z.object({
  brinco: z.string().trim().min(1).max(40).optional(),
  nome: z.string().trim().max(120).nullable().optional(),
  brincoEletronico: z.string().trim().max(40).nullable().optional(),
  sisbov: z.string().trim().max(40).nullable().optional(),
  sexo: z.enum(["F", "M"]).optional(),
  dataNascimento: dataNaoFutura.optional(),
  nascimentoEstimado: z.boolean().optional(),
  origem: z.enum(["NASCIDO", "COMPRADO"]).optional(),
  dataEntrada: dataNaoFutura.optional(),
  partosAntesDaEntrada: z.number().int().min(0).optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
}).merge(filiacaoCamposSchema).superRefine(exigirLadoUnico);
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;

export const substituirComposicaoSchema = z.object({
  itens: z.array(composicaoItemSchema),
});
export type SubstituirComposicaoInput = z.infer<typeof substituirComposicaoSchema>;

export const movimentarSchema = z.object({
  animalIds: z.array(z.string().uuid()).min(1).max(2000).refine((v) => new Set(v).size === v.length, "IDs de animais repetidos"),
  propriedadeId: propriedadeIdObrigatorio,
  loteId: z.string().uuid().nullable().optional(),
  data: dataNaoFutura,
  motivo: z.string().trim().max(300).nullable().optional(),
});
export type MovimentarInput = z.infer<typeof movimentarSchema>;

export const mudarDestinoSchema = z.object({
  animalId: z.string().uuid().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional().default("NENHUM"),
  data: dataNaoFutura,
});
export type MudarDestinoInput = z.infer<typeof mudarDestinoSchema>;

export const tipoBaixaSchema = z.enum(["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO", "CADASTRO_INDEVIDO"]);
export const classeMotivoBaixaSchema = z.enum(["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO", "MORTE"]);

export const baixaSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataNaoFutura,
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
  propriedadeId: propriedadeIdOpcional,
  /** filtra as movimentações que têm esse animal nos itens (inclusive as desfeitas, se `incluirDesfeitas`) */
  animalId: z.string().uuid().optional(),
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

/**
 * Janela do GMD (peso/ficha e resumo do lote): 30/90/180/365 dias, ou "entrada" — sem limite
 * inferior (todo o histórico até a referência), que vira `periodoDias: null` para `resumoPeso`.
 * Default 90 (Definições do plano da v1).
 */
const periodoDiasCampo = z.union([z.enum(["30", "90", "180", "365"]), z.literal("entrada")])
  .optional().default("90")
  .transform((v) => (v === "entrada" ? null : Number(v)));
export const gmdPeriodoQuerySchema = z.object({ periodoDias: periodoDiasCampo });
export type GmdPeriodoQuery = z.infer<typeof gmdPeriodoQuerySchema>;

/** Janela do painel (contagem de baixas): 30/90/180/365 dias, default 30 — sem "entrada" (não faz sentido aqui). */
const periodoDiasPainelCampo = z.enum(["30", "90", "180", "365"]).optional().default("30").transform(Number);
export const painelQuerySchema = z.object({ periodoDias: periodoDiasPainelCampo });
export type PainelQuery = z.infer<typeof painelQuerySchema>;

export const auditoriaAnimalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type AuditoriaAnimalQuery = z.infer<typeof auditoriaAnimalQuerySchema>;

export const auditoriaCadastroQuerySchema = z.object({
  entidade: z.enum(["Lote", "Raca", "MotivoBaixa", "CategoriaAnimal", "GenitorExterno", "MaterialGenetico"]),
  entidadeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type AuditoriaCadastroQuery = z.infer<typeof auditoriaCadastroQuerySchema>;

export const pesagemSchema = z.object({
  animalId: z.string().uuid().optional(),
  data: dataNaoFutura,
  pesoKg: pesoKgSchema,
  tipo: z.enum(["NASCIMENTO", "ENTRADA", "DESMAMA", "ROTINA", "SAIDA"]),
  origem: z.enum(["MANUAL", "BALANCA"]).optional().default("MANUAL"),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type PesagemInput = z.infer<typeof pesagemSchema>;

export const editarPesagemSchema = z.object({
  data: dataNaoFutura.optional(),
  pesoKg: pesoKgSchema.optional(),
  tipo: z.enum(["NASCIMENTO", "ENTRADA", "DESMAMA", "ROTINA", "SAIDA"]).optional(),
  origem: z.enum(["MANUAL", "BALANCA"]).optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarPesagemInput = z.infer<typeof editarPesagemSchema>;

/** Booleano de query string: só "true" liga; ausente/"false" = false. */
const booleanoQuery = z.enum(["true", "false"]).optional().transform((v) => v === "true");
/** Meses (idade) vindos da query string. */
const mesesQuery = z.coerce.number().int().min(0).max(600);

export const listarFiltrosSchema = z.object({
  propriedadeId: propriedadeIdOpcional,
  loteId: z.string().uuid().optional(),
  /** exclui da lista os animais cuja localização aberta está neste lote (ex.: "Trazer animais") */
  excluirLoteId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  aptidao: z.enum(["LEITE", "CORTE"]).optional(),
  papelReprodutivo: z.enum(["NENHUM", "RECEPTORA", "DOADORA"]).optional(),
  situacao: z.enum(["ATIVO", "BAIXADO", "TODOS"]).optional().default("ATIVO"),
  busca: z.string().trim().max(120).optional(),
  sexo: z.enum(["F", "M"]).optional(),
  origem: z.enum(["NASCIDO", "COMPRADO"]).optional(),
  /** a composição racial do animal contém esta raça (qualquer fração) */
  racaId: z.string().uuid().optional(),
  /** idade em meses completos (`idadeEmMeses`), extremos inclusivos; baixado: idade na data da baixa (K5) */
  idadeMinMeses: mesesQuery.optional(),
  idadeMaxMeses: mesesQuery.optional(),
  /** só animais com categoria forçada (troca manual aberta) */
  categoriaOrigem: z.enum(["MANUAL"]).optional(),
  /** sem manual aberta e nenhuma regra automática ativa casa */
  semCategoria: booleanoQuery,
  /** filtros da baixa em vigor (não estornada); ignorados com `situacao=ATIVO` */
  tipoBaixa: tipoBaixaSchema.optional(),
  baixaDe: dataISO.optional(),
  baixaAte: dataISO.optional(),
  ordenar: z.enum(["brinco", "nascimento", "entrada"]).optional().default("brinco"),
  direcao: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
}).superRefine((f, ctx) => {
  if (f.semCategoria && f.categoriaId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["semCategoria"], message: "“Sem categoria” não combina com uma categoria escolhida" });
  }
  if (f.semCategoria && f.categoriaOrigem) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["semCategoria"], message: "“Sem categoria” não combina com “categoria forçada”" });
  }
  if (f.idadeMinMeses != null && f.idadeMaxMeses != null && f.idadeMinMeses > f.idadeMaxMeses) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["idadeMaxMeses"], message: "A idade máxima não pode ser menor que a mínima" });
  }
  if (f.baixaDe && f.baixaAte && f.baixaDe > f.baixaAte) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["baixaAte"], message: "A data final da baixa não pode ser anterior à inicial" });
  }
});
export type ListarFiltrosInput = z.infer<typeof listarFiltrosSchema>;

export const criarLoteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  propriedadeId: propriedadeIdObrigatorio,
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
  ordem: ordemInt.optional(),
});
export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;

export const editarCategoriaSchema = z.object({
  nome: z.string().trim().min(1).max(60).optional(),
  sexo: sexoBovino.optional(),
  automatica: z.boolean().optional(),
  idadeMinMeses: meses.nullable().optional(),
  idadeMaxMeses: meses.nullable().optional(),
  partos: criterioPartos.optional(),
  ordem: ordemInt.optional(),
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
  ordem: ordemInt,
  idadeMinMeses: meses.nullable().optional(),
  idadeMaxMeses: meses.nullable().optional(),
  partos: criterioPartos,
});
export type RegraPropostaInput = z.infer<typeof regraPropostaSchema>;

export const simularCategoriasSchema = z.object({ regras: z.array(regraPropostaSchema).max(200) });
export const reordenarCategoriasSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500).refine((v) => new Set(v).size === v.length, "IDs de categoria repetidos"),
});
export const restaurarPadroesSchema = z.object({ simular: z.boolean().optional().default(false) });

export const categoriaManualSchema = z.object({
  categoriaId: z.string().uuid(),
  data: dataNaoFutura,
  motivo: z.string().trim().min(1).max(300),
});
export type CategoriaManualInput = z.infer<typeof categoriaManualSchema>;

export const removerCategoriaManualSchema = z.object({
  motivo: z.string().trim().min(1).max(300),
});
export type RemoverCategoriaManualInput = z.infer<typeof removerCategoriaManualSchema>;

// ---------- genética (v2): genitores externos e filiação ----------

export const criarGenitorSchema = z.object({
  sexo: z.enum(["F", "M"]),
  nome: z.string().trim().min(1).max(120),
  codigo: z.string().trim().max(60).nullable().optional(),
  fornecedor: z.string().trim().max(120).nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
  composicao: z.array(composicaoItemSchema).optional().default([]),
});
export type CriarGenitorInput = z.infer<typeof criarGenitorSchema>;

export const editarGenitorSchema = z.object({
  sexo: z.enum(["F", "M"]).optional(),
  nome: z.string().trim().min(1).max(120).optional(),
  codigo: z.string().trim().max(60).nullable().optional(),
  fornecedor: z.string().trim().max(120).nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type EditarGenitorInput = z.infer<typeof editarGenitorSchema>;

export const substituirComposicaoGenitorSchema = z.object({
  itens: z.array(composicaoItemSchema),
});
export type SubstituirComposicaoGenitorInput = z.infer<typeof substituirComposicaoGenitorSchema>;

export const listarGenitoresQuerySchema = z.object({
  sexo: z.enum(["F", "M"]).optional(),
  incluirInativos: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  q: z.string().trim().max(120).optional(),
});
export type ListarGenitoresQuery = z.infer<typeof listarGenitoresQuerySchema>;

export const definirFiliacaoSchema = filiacaoCamposSchema.superRefine(exigirLadoUnico);
export type DefinirFiliacaoInput = z.infer<typeof definirFiliacaoSchema>;


// ---------- genética (v2): material genético (sêmen/embrião como produto do estoque) ----------

const refGenitorSchema = z.object({ tipo: z.enum(["ANIMAL", "EXTERNO"]), id: z.string().uuid() });

export const criarMaterialGeneticoSchema = z.object({
  tipo: z.enum(["SEMEN", "EMBRIAO"]),
  tipoSemen: z.enum(["CONVENCIONAL", "SEXADO_FEMEA", "SEXADO_MACHO"]).nullable().optional(),
  touro: refGenitorSchema,
  doadora: refGenitorSchema.nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
  produto: z.object({
    nome: z.string().trim().min(2).max(80).optional(),
    categoriaId: z.string().uuid(),
    centroCustoIds: z.array(z.string().uuid()).optional(),
    fornecedorIds: z.array(z.string().uuid()).optional(),
  }),
}).superRefine((v, ctx) => {
  if (v.tipo === "EMBRIAO" && !v.doadora) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["doadora"], message: "Embrião precisa de doadora" });
  if (v.tipo === "SEMEN" && v.doadora) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["doadora"], message: "Sêmen não tem doadora" });
  if (v.tipo === "EMBRIAO" && v.tipoSemen) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tipoSemen"], message: "Tipo de sêmen só vale para sêmen" });
});
export type CriarMaterialGeneticoInput = z.infer<typeof criarMaterialGeneticoSchema>;

export const editarMaterialGeneticoSchema = z.object({
  tipoSemen: z.enum(["CONVENCIONAL", "SEXADO_FEMEA", "SEXADO_MACHO"]).nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});
export type EditarMaterialGeneticoInput = z.infer<typeof editarMaterialGeneticoSchema>;

export const listarMaterialGeneticoQuerySchema = z.object({
  tipo: z.enum(["SEMEN", "EMBRIAO"]).optional(),
  incluirInativos: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
});
export type ListarMaterialGeneticoQuery = z.infer<typeof listarMaterialGeneticoQuerySchema>;
