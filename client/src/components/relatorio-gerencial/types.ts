/* Espelho do DTO de server/src/services/relatorio-gerencial.ts + estado do template. */

export type RegimeRelatorio = "realizado" | "previsto" | "ambos";
export type Atividade = "leite" | "cafe" | "outros";
export type TipoOperacao = "receita" | "custeio" | "investimento" | "transferencia" | "compromisso" | "parcial" | "estorno";

export interface TotaisFluxo { entradas: number; saidas: number; resultado: number }
export interface MesFluxo extends TotaisFluxo { mes: string }
export interface ResultadoAtividade { atividade: Atividade; receita: number; custeio: number; investimento: number; resultado: number }
export interface ResultadoPeriodo { receita: number; custeio: number; investimento: number; resultado: number; porAtividade: ResultadoAtividade[] }
export interface CategoriaTotal { categoria: string; total: number; pct: number }
export interface CentroTotal { centro: string; total: number; pct: number }
export interface ItemCompromisso { id: number; descricao: string | null; fornecedor: string | null; categoria: string; valor: number; dataVencimento: string; diasAtraso: number; vencido: boolean }
export interface BlocoCompromisso { total: number; vencido: number; aVencer: number; quantidade: number; itens: ItemCompromisso[] }
export interface SaldoConta { id: number; nome: string; banco: string | null; saldoInicial: number; entradas: number; saidas: number; saldoFinal: number }
export interface OperacaoPorTipo { tipo: TipoOperacao; quantidade: number; valor: number; entraNoTotal: boolean }

export interface RelatorioGerencialDTO {
  meta: {
    geradoEm: string;
    propriedade: { id: number; nome: string } | null;
    periodo: { inicio: string; fim: string };
    regime: RegimeRelatorio;
    hoje: string;
  };
  resumo: {
    entradas: number | null;
    saidas: number | null;
    resultado: number | null;
    saldoContasFinal: number | null;
    nLancamentos: number | null;
    aPagar: number | null;
    aReceber: number | null;
  };
  saldoContas: { contas: SaldoConta[]; total: { saldoInicial: number; entradas: number; saidas: number; saldoFinal: number } } | null;
  entradasSaidas: { meses: MesFluxo[]; total: TotaisFluxo } | null;
  resultado: ResultadoPeriodo | null;
  compromissos: { hoje: string; aPagar: BlocoCompromisso; aReceber: BlocoCompromisso } | null;
  categorias: { itens: CategoriaTotal[]; centros: CentroTotal[] } | null;
  operacoes: OperacaoPorTipo[];
  rastreabilidade: {
    totalLancamentos: number;
    estornados: number;
    comDocumento: number;
    semDocumento: number;
    comNotaFiscal: number;
    semNotaFiscal: number;
    semCentroCusto: number;
    mesesFechados: string[];
    mesesAbertos: string[];
  };
}

export type SecaoId = "resumo" | "saldoContas" | "entradasSaidas" | "resultado" | "compromissos" | "categorias" | "operacoes" | "rastreabilidade";

export interface SecaoTemplate { id: SecaoId; visivel: boolean }

export interface TemplateRelatorio {
  titulo: string;
  subtitulo: string;
  observacoes: string;
  secoes: SecaoTemplate[];
}
