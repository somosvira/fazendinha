export type PeriodoDashboard = "hoje" | "7d" | "30d";
export type TabRebanho = "reproducao" | "sanidade" | "nutricao" | "animal" | "producao";
export type SeveridadeAlerta = "alta" | "media" | "baixa";
export type StatusReprodutivoDashboard = "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
export type ChaveWorklistRebanho = "secagem-atrasada" | "vazia-pos-pev" | "ccs-alta" | "dg-pendente" | "parto-proximo";
export type TipoAcaoWorklist = "SECAGEM" | "INSEMINACAO" | "EXAME" | "DIAGNOSTICO" | "PARTO";

export interface AcaoWorklistDTO {
  tipo: TipoAcaoWorklist;
  rotulo: string;
}

export interface ItemWorklistDTO {
  animalId: number;
  numero: string;
  nome: string | null;
  categoria: string;
  grupo: string | null;
  setor: string | null;
  motivo: string;
  valor: number | null;
  unidade: string | null;
  dataReferencia: string | null;
  ccs: number | null;
  ccsTendencia: string | null;
  del: number | null;
  diasGestacao: number | null;
  previsaoSecagem: string | null;
  ultimaCoberturaData: string | null;
  ultimaCoberturaTipo: "INSEMINACAO" | "TRANSFERENCIA_EMBRIAO" | null;
}

export interface WorklistRebanhoDTO {
  chave: ChaveWorklistRebanho;
  titulo: string;
  quantidade: number;
  explicacao: string;
  severidade: SeveridadeAlerta;
  tab: TabRebanho;
  acao: AcaoWorklistDTO;
  itens: ItemWorklistDTO[];
}

export interface ResumoDashboardIn {
  statusReprodutivo: StatusReprodutivoDashboard;
  del: number | null;
  producaoMediaDia: number | null;
  ccs: number | null;
  ccsTendencia: string | null;
  iepProjetado: number | null;
  diasGestacao: number | null;
  previsaoSecagem: string | null;
  ultimoDgData: string | null;
}

export interface AnimalDashboardIn {
  id: number;
  numero: string;
  nome: string | null;
  categoria: string;
  sexo: string;
  grupoId: number | null;
  grupoNome: string | null;
  setor: string | null;
  resumo: ResumoDashboardIn | null;
}

export interface LactacaoDashboardIn {
  animalId: number;
  dtInicio: string;
  dtFim: string | null;
}

export interface ControleDashboardIn {
  id: number;
  animalId: number;
  data: string;
  pesoTotal: number;
  atualizadoEm: string;
}

export interface ProducaoLoteDashboardIn {
  id: number;
  grupoId: number | null;
  data: string;
  litros: number;
  atualizadoEm: string;
}

export interface EventoConcepcaoDashboardIn {
  animalId: number;
  tipo: string;
  data: string;
  resultado: string | null;
}

export interface ParametrosDashboard {
  pevDias: number;
  gestacaoDias: number;
  secagemAntec: number;
  ccsAlto: number;
}

export interface DashboardRebanhoInput {
  hoje: string;
  geradoEm: string;
  periodo: PeriodoDashboard;
  modoProducao: "ORDENHA" | "TOTAL_DIARIO" | "TANQUE_LOTE";
  escopoPropriedadeId: number | null;
  animais: AnimalDashboardIn[];
  lactacoes: LactacaoDashboardIn[];
  controles: ControleDashboardIn[];
  producoesLote: ProducaoLoteDashboardIn[];
  eventosConcepcao: EventoConcepcaoDashboardIn[];
  parametros: ParametrosDashboard;
}

export interface SerieDiariaDTO {
  data: string;
  valor: number | null;
}

export interface HeroDTO {
  chave: "vacasLactacao" | "mediaVacaDia" | "producaoTotalDia" | "pctVacasLactacao";
  titulo: string;
  valor: number | null;
  unidade: string;
  valorAnterior: number | null;
  variacaoPct: number | null;
  indisponivelMotivo: string | null;
  serie: SerieDiariaDTO[];
}

export interface IndicadorDashboardDTO {
  chave: string;
  titulo: string;
  valor: number | null;
  unidade: string;
  amostra: number;
  indisponivelMotivo: string | null;
}

export interface DashboardDTO {
  meta: {
    periodo: PeriodoDashboard;
    inicio: string;
    fim: string;
    comparacaoInicio: string;
    comparacaoFim: string;
    geradoEm: string;
    dadoMaisRecente: string | null;
    cobertura: { diasEsperados: number; diasComProducao: number; percentual: number; producaoParcial: boolean; motivo: string | null };
    escopo: { propriedadeId: number | null; consolidado: boolean };
  };
  totais: { rebanhoAtivo: number; vacasAtivas: number };
  herois: HeroDTO[];
  estadosReprodutivos: { estado: StatusReprodutivoDashboard; quantidade: number; percentual: number | null }[];
  indicadores: { grupo: "producao" | "reproducao" | "rebanho"; titulo: string; itens: IndicadorDashboardDTO[] }[];
  alertas: WorklistRebanhoDTO[];
  grupos: { id: number | null; nome: string; quantidade: number; percentual: number | null }[];
  qualidadeDados: { chave: string; titulo: string; quantidade: number; explicacao: string }[];
}
