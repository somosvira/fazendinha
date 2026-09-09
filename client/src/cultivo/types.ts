/* Tipos do módulo Cultivo (milho).
 * Espelham EXATAMENTE os DTOs devolvidos por server/src/services/cultivo/mappers.ts
 * (toSafraCultivoDTO, toAreaCultivoDTO, toLancamentoCustoDTO, toProducaoCultivoDTO,
 * toSiloDTO, toMovimentoSiloDTO, toResumoSafraCultivoDTO) — não inventar campos.
 * Decimais já chegam como number (convertidos na borda do backend via Number()),
 * datas como string YYYY-MM-DD. */

export type Cultura = "MILHO";

export type ClassificacaoCategoria = "CUSTEIO" | "INVESTIMENTO";

export type TipoCustoCultivo =
  | "ADUBACAO"
  | "PREPARO_SOLO"
  | "PLANTIO"
  | "TRATOS"
  | "COLHEITA"
  | "TRANSPORTE"
  | "MAO_DE_OBRA"
  | "MAQUINA"
  | "OUTRO";

export type TipoProducao = "GRAO" | "SILAGEM";
export type UnidadeProducao = "SC" | "TON";
export type DestinoProducao = "VENDA" | "SILO";
export type TipoSilo = "GRAO" | "SILAGEM";
export type TipoMovimentoSilo = "ENTRADA" | "SAIDA";
export type OrigemMovimentoSilo = "COLHEITA" | "NUTRICAO" | "VENDA" | "AJUSTE";

// Contrato ?classe= uniforme (§6.4) aceito nos endpoints de custo/resumo.
export type ClasseFiltro = "custeio" | "investimento" | "tudo";

// ── SafraCultivo ─────────────────────────────────────────────────────────
// Espelha toSafraCultivoDTO. `resumo` vem embutido quando o backend inclui a
// relação (listagem/detalhe sempre trazem); undefined só se o backend omitir.
export interface SafraCultivo {
  id: number;
  cultura: Cultura;
  nome: string;
  ano: number;
  dataInicio: string;              // YYYY-MM-DD
  dataFim: string | null;          // YYYY-MM-DD
  areaHaTotal: number | null;
  fechada: boolean;
  observacao: string | null;
  resumo?: ResumoSafraCultivo | null;
}

// ── AreaCultivo ──────────────────────────────────────────────────────────
// Espelha toAreaCultivoDTO.
export interface AreaCultivo {
  id: number;
  safraCultivoId: number;
  codigo: string;
  nome: string | null;
  areaHa: number;
}

// ── LancamentoCusto ──────────────────────────────────────────────────────
// Espelha toLancamentoCustoDTO.
export interface LancamentoCusto {
  id: number;
  safraCultivoId: number;
  areaCultivoId: number | null;
  areaCodigo: string | null;
  tipo: TipoCustoCultivo;
  classe: ClassificacaoCategoria;
  data: string;                    // YYYY-MM-DD
  descricao: string;
  valor: number;
  qtd: number | null;
  unidade: string | null;
  horasMaquina: number | null;
  numMaquinas: number | null;
  numCaminhoes: number | null;
  operacaoFinanceiraId: number | null;
  observacao: string | null;
}

// ── ProducaoCultivo ──────────────────────────────────────────────────────
// Espelha toProducaoCultivoDTO.
export interface ProducaoCultivo {
  id: number;
  safraCultivoId: number;
  areaCultivoId: number | null;
  areaCodigo: string | null;
  data: string;                    // YYYY-MM-DD
  tipo: TipoProducao;
  quantidade: number;
  unidade: UnidadeProducao;
  destino: DestinoProducao | null;
  siloId: number | null;
  siloNome: string | null;
  observacao: string | null;
}

// ── Silo ─────────────────────────────────────────────────────────────────
// Espelha toSiloDTO.
export interface Silo {
  id: number;
  nome: string;
  tipo: TipoSilo;
  capacidade: number | null;
  unidade: string;
  saldoAtual: number;
  ativo: boolean;
}

// ── MovimentoSilo ────────────────────────────────────────────────────────
// Espelha toMovimentoSiloDTO.
export interface MovimentoSilo {
  id: number;
  siloId: number;
  data: string;                    // YYYY-MM-DD
  tipo: TipoMovimentoSilo;
  quantidade: number;
  origem: OrigemMovimentoSilo;
  producaoCultivoId: number | null;
  observacao: string | null;
}

// ── ResumoSafraCultivo ───────────────────────────────────────────────────
// Read-model pré-computado por safra — espelha toResumoSafraCultivoDTO,
// incluindo `nota` (mensagem derivada, não persistida, sobre safra mista
// grão+silagem quando custoSaca/custoTonelada vêm nulos).
export interface ResumoSafraCultivo {
  safraCultivoId: number;
  custeioTotal: number;
  investimentoTotal: number;
  areaHa: number;
  producaoGraoSc: number;
  producaoSilagemTon: number;
  custoHa: number | null;
  custoSaca: number | null;
  custoTonelada: number | null;
  horasMaquinaTotal: number;
  nota: string | null;
  atualizadoEm: string | null;     // ISO
}

// GET /cultivo/safras/:id/resumo?classe= devolve o ResumoSafraCultivo mais
// `classe` (eco do filtro aplicado) e `total` (headline conforme a classe —
// custeioTotal | investimentoTotal | soma dos dois).
export interface ResumoSafraCultivoComTotal extends ResumoSafraCultivo {
  classe: ClasseFiltro;
  total: number;
}
