// Tipos da camada semântica de consulta da IA.
//
// A ideia: o LLM só preenche parâmetros (ConsultaInput); a instrumentação
// declarada aqui (DominioDef → EntidadeDef → dimensões/métricas/regimes) é quem
// sabe traduzir isso em Prisma e agregar deterministicamente. A IA nunca gera
// SQL nem faz aritmética — toda conta (soma, média, delta, %, razão) sai do
// motor, em Prisma.Decimal.

import type { Prisma } from "@prisma/client";

export type OperadorFiltro = "igual" | "diferente" | "contem" | "nao_contem" | "em";
export type LinhaBase = Record<string, unknown>;

// Dimensão = coluna filtrável e/ou agrupável de uma entidade. `where` e `rotulo`
// são funções (não caminhos em string) para cobrir relações N:1 de 1 ou 2 saltos
// (ex.: categoria.grupoCategoria.nome) mantendo tradutor/agregador genéricos.
export interface DimensaoDef {
  descricao: string; // vai para o JSON Schema / description da tool
  tipo: "texto" | "enum" | "numero" | "booleano";
  valores?: readonly string[]; // enums Prisma (valores permitidos no filtro)
  cardinalidade: "baixa" | "alta"; // alta ⇒ agrupamento sempre sai top-N
  operadores: readonly OperadorFiltro[];
  agrupavel: boolean;
  where: (op: OperadorFiltro, valor: string | string[]) => Record<string, unknown>;
  select?: Record<string, unknown>; // ex.: { categoria: { select: { nome: true } } }
  rotulo?: (linha: LinhaBase) => string; // chave do grupo a partir da linha crua
}

export interface MetricaDef {
  descricao: string;
  agregacao:
    | "soma"
    | "media"
    | "mediana"
    | "desvio_padrao" // populacional, mesma convenção da antiga estatisticas_lancamentos
    | "contagem"
    | "contagem_distinta"
    | "min"
    | "max";
  select?: Record<string, unknown>; // colunas que o findMany precisa trazer
  // Extrai o valor da linha crua (null = ignora a linha nesta métrica).
  // Para contagem_distinta pode devolver string (a chave de distinção).
  valor?: (linha: LinhaBase) => Prisma.Decimal | number | string | null;
  formato: "reais" | "litros" | "inteiro" | "numero";
}

// Regime = semântica temporal + filtros implícitos. Ex.: no financeiro,
// "realizado" = regime de caixa (LIQUIDADO por dataLiquidacao) e "a_vencer" =
// projeção (ABERTO por dataVencimento). campoData null = snapshot (ex.: cadastro sem data).
export interface RegimeDef {
  descricao: string;
  filtrosFixos: Record<string, unknown>; // ex.: { situacao: "LIQUIDADO", estornado: false }
  campoData: string | null;
}

export interface EntidadeDef {
  descricao: string;
  modelo: string; // delegate Prisma: "transacaoFinanceira", "compromissoFinanceiro"…
  regimes: Record<string, RegimeDef>;
  regimeDefault: string;
  // Regra dura: métricas destes formatos EXIGEM a dimensão citada em filtros,
  // agruparPor ou comparar.fatias — a validação rejeita e ensina (ex.: R$ sem
  // natureza somaria créditos e débitos num número que parece "gasto").
  exigeDimensao?: { dimensao: string; formatos: readonly string[]; mensagem: string };
  // null = entidade não particionada por sítio (o motor avisa em `observacoes`).
  escopoPropriedade: ((propriedadeId: number) => Record<string, unknown>) | null;
  dimensoes: Record<string, DimensaoDef>;
  metricas: Record<string, MetricaDef>;
  maxLinhasBase?: number; // teto de linhas cruas por query (default 50_000)
}

// Razão pré-instrumentada entre duas métricas (possivelmente de domínios
// diferentes, ex.: custo/litro). O motor roda as duas queries com o MESMO
// período, alinha os buckets e divide com Decimal — o LLM nunca divide nada.
export interface LadoRazao {
  dominio: string;
  entidade: string;
  regime?: string; // default: regimeDefault da entidade
  metrica: string;
  filtrosFixos?: { dimensao: string; operador: OperadorFiltro; valor: string }[];
  aceitaFiltros?: readonly string[]; // dimensões que o LLM pode repassar a este lado
}

export interface RazaoDef {
  descricao: string;
  numerador: LadoRazao;
  denominador: LadoRazao;
  formato: "reais" | "numero";
  granularidades: readonly ("total" | "mes" | "ano")[];
}

export interface DominioDef {
  nome: string; // "financeiro" | …
  descricao: string;
  entidades: Record<string, EntidadeDef>;
  razoes?: Record<string, RazaoDef>;
}

// ── Consulta (o que o LLM envia) ─────────────────────────────────────────────

export interface FiltroInput {
  dimensao: string;
  operador: OperadorFiltro;
  valor: string | string[];
}

export type CompararInput =
  | { tipo: "periodos"; deB: string; ateB: string }
  | { tipo: "fatias"; dimensao: string; valorA: string; valorB: string };

// Consulta normalizada pós-validação (defaults resolvidos).
export interface ConsultaEntidade {
  tipo: "entidade";
  entidade: string;
  regime: string;
  metricas: string[];
  filtros: FiltroInput[];
  agruparPor: string[];
  granularidadeTempo?: "mes" | "ano";
  de?: string; // YYYY-MM-DD
  ate?: string;
  ordenarPor?: { alvo: string; direcao: "asc" | "desc" };
  limite: number;
  comparar?: CompararInput;
}

export interface ConsultaRazao {
  tipo: "razao";
  razao: string;
  filtros: FiltroInput[];
  granularidadeTempo?: "mes" | "ano";
  de?: string;
  ate?: string;
}

export type ConsultaValidada = ConsultaEntidade | ConsultaRazao;

// Contexto resolvido POR FORA da conversa (o LLM nunca escolhe propriedade).
export interface ContextoConsulta {
  propriedadeId: number | null;
}

// ── Resultado ────────────────────────────────────────────────────────────────

export interface GrupoResultado {
  chaves: Record<string, string>; // { categoria: "Pessoal - Salário", ... }
  tempo?: string; // "2026-03" | "2026"
  metricas: Record<string, number | null>;
}

// Estatística sobre os BUCKETS temporais de uma série (só métricas aditivas):
// "média mensal", "mês de maior/menor saída" saem daqui, prontos.
export interface ResumoTempoMetrica {
  buckets: number;
  media: number | null;
  mediana: number | null;
  maior: { tempo: string; valor: number } | null;
  menor: { tempo: string; valor: number } | null;
}

export interface ComparacaoGrupo {
  chaves: Record<string, string>;
  tempo?: string;
  metricas: Record<
    string,
    { valorA: number | null; valorB: number | null; delta: number | null; deltaPct: number | null }
  >;
}

export interface ComparacaoResultado {
  porGrupo: ComparacaoGrupo[];
  totais: Record<
    string,
    { valorA: number | null; valorB: number | null; delta: number | null; deltaPct: number | null }
  >;
  somenteA: Record<string, string>[]; // chaves que só existem no lado A
  somenteB: Record<string, string>[];
}
