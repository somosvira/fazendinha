import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const cultura = z.enum(["MILHO"]);
export const classificacaoCategoria = z.enum(["CUSTEIO", "INVESTIMENTO"]);
export const tipoCustoCultivo = z.enum([
  "ADUBACAO",
  "PREPARO_SOLO",
  "PLANTIO",
  "TRATOS",
  "COLHEITA",
  "TRANSPORTE",
  "MAO_DE_OBRA",
  "MAQUINA",
  "OUTRO",
]);
export const tipoProducao = z.enum(["GRAO", "SILAGEM"]);
export const unidadeProducao = z.enum(["SC", "TON"]);
export const destinoProducao = z.enum(["VENDA", "SILO"]);
export const tipoSilo = z.enum(["GRAO", "SILAGEM"]);
export const tipoMovimentoSilo = z.enum(["ENTRADA", "SAIDA"]);
export const origemMovimentoSilo = z.enum(["COLHEITA", "NUTRICAO", "VENDA", "AJUSTE"]);

// Contrato ?classe= uniforme (§6.4) — aceito nos endpoints de custo/resumo.
export const classeFiltro = z.enum(["custeio", "investimento", "tudo"]).default("custeio");

// ── SafraCultivo ─────────────────────────────────────────────────────────
export const criarSafraCultivoSchema = z.object({
  cultura,
  nome: z.string().min(1, "nome é obrigatório").max(80),
  ano: z.number().int(),
  dataInicio: isoDate,
  dataFim: isoDate.nullish(),
  areaHaTotal: z.number().nonnegative().nullish(),
  observacao: z.string().max(400).nullish(),
});

export const editarSafraCultivoSchema = criarSafraCultivoSchema.partial();

export const listSafraCultivoFiltrosSchema = z.object({
  cultura: cultura.optional(),
  fechada: z.coerce.boolean().optional(),
  ano: z.coerce.number().int().optional(),
});

// ── AreaCultivo ──────────────────────────────────────────────────────────
export const criarAreaCultivoSchema = z.object({
  safraCultivoId: z.number().int().positive(),
  codigo: z.string().min(1, "código é obrigatório").max(20),
  nome: z.string().max(80).nullish(),
  areaHa: z.number().nonnegative(),
});

export const editarAreaCultivoSchema = criarAreaCultivoSchema.partial().omit({ safraCultivoId: true });

export const listAreaCultivoFiltrosSchema = z.object({
  safraCultivoId: z.coerce.number().int().positive().optional(),
});

// ── LancamentoCusto ──────────────────────────────────────────────────────
export const criarLancamentoCustoSchema = z.object({
  safraCultivoId: z.number().int().positive(),
  areaCultivoId: z.number().int().positive().nullish(),
  tipo: tipoCustoCultivo,
  classe: classificacaoCategoria.default("CUSTEIO"),
  data: isoDate,
  descricao: z.string().min(1, "descrição é obrigatória").max(200),
  valor: z.number().nonnegative(),
  qtd: z.number().nonnegative().nullish(),
  unidade: z.string().max(20).nullish(),
  horasMaquina: z.number().nonnegative().nullish(),
  numMaquinas: z.number().int().nonnegative().nullish(),
  numCaminhoes: z.number().int().nonnegative().nullish(),
  observacao: z.string().max(400).nullish(),
});

export const editarLancamentoCustoSchema = criarLancamentoCustoSchema.partial().omit({ safraCultivoId: true });

export const listLancamentoCustoFiltrosSchema = z.object({
  safraCultivoId: z.coerce.number().int().positive().optional(),
  areaCultivoId: z.coerce.number().int().positive().optional(),
  classe: classeFiltro.optional(),
});

// ── ProducaoCultivo ──────────────────────────────────────────────────────
export const criarProducaoCultivoSchema = z.object({
  safraCultivoId: z.number().int().positive(),
  areaCultivoId: z.number().int().positive().nullish(),
  data: isoDate,
  tipo: tipoProducao,
  quantidade: z.number().positive(),
  unidade: unidadeProducao,
  destino: destinoProducao.nullish(),
  siloId: z.number().int().positive().nullish(),
  observacao: z.string().max(400).nullish(),
});

export const editarProducaoCultivoSchema = criarProducaoCultivoSchema.partial().omit({ safraCultivoId: true });

export const listProducaoCultivoFiltrosSchema = z.object({
  safraCultivoId: z.coerce.number().int().positive().optional(),
  areaCultivoId: z.coerce.number().int().positive().optional(),
});

// ── Silo ─────────────────────────────────────────────────────────────────
export const criarSiloSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(80),
  tipo: tipoSilo,
  capacidade: z.number().nonnegative().nullish(),
  unidade: z.string().min(1, "unidade é obrigatória").max(20),
  ativo: z.boolean().default(true),
});

export const editarSiloSchema = criarSiloSchema.partial();

export const listSiloFiltrosSchema = z.object({
  tipo: tipoSilo.optional(),
  ativo: z.coerce.boolean().optional(),
});

// Movimento manual (SAIDA: NUTRICAO/VENDA/AJUSTE). ENTRADA/COLHEITA é gerada
// automaticamente por ProducaoCultivo(destino=SILO) — não exposta aqui.
export const criarMovimentoSiloSchema = z.object({
  data: isoDate,
  tipo: tipoMovimentoSilo,
  quantidade: z.number().positive(),
  origem: origemMovimentoSilo,
  observacao: z.string().max(400).nullish(),
});

export type CriarSafraCultivoInput = z.infer<typeof criarSafraCultivoSchema>;
export type EditarSafraCultivoInput = z.infer<typeof editarSafraCultivoSchema>;
export type ListSafraCultivoFiltros = z.infer<typeof listSafraCultivoFiltrosSchema>;

export type CriarAreaCultivoInput = z.infer<typeof criarAreaCultivoSchema>;
export type EditarAreaCultivoInput = z.infer<typeof editarAreaCultivoSchema>;
export type ListAreaCultivoFiltros = z.infer<typeof listAreaCultivoFiltrosSchema>;

export type CriarLancamentoCustoInput = z.infer<typeof criarLancamentoCustoSchema>;
export type EditarLancamentoCustoInput = z.infer<typeof editarLancamentoCustoSchema>;
export type ListLancamentoCustoFiltros = z.infer<typeof listLancamentoCustoFiltrosSchema>;

export type CriarProducaoCultivoInput = z.infer<typeof criarProducaoCultivoSchema>;
export type EditarProducaoCultivoInput = z.infer<typeof editarProducaoCultivoSchema>;
export type ListProducaoCultivoFiltros = z.infer<typeof listProducaoCultivoFiltrosSchema>;

export type CriarSiloInput = z.infer<typeof criarSiloSchema>;
export type EditarSiloInput = z.infer<typeof editarSiloSchema>;
export type ListSiloFiltros = z.infer<typeof listSiloFiltrosSchema>;
export type CriarMovimentoSiloInput = z.infer<typeof criarMovimentoSiloSchema>;

export type ClasseFiltro = z.infer<typeof classeFiltro>;
