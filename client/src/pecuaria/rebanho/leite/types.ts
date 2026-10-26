export interface EvidenciaFinalidadeLeite {
  estado: "COMPROVADA" | "PENDENTE_CONCILIACAO";
  finalidadeId: string | null;
  aptidao: "LEITE" | null;
  dataOperacional: string;
  regra: "FINALIDADE_LEITE_V1" | null;
}
export interface ImpedimentoProducaoLeite {
  animalId: string;
  brinco: string;
  nome: string | null;
  codigo: string;
  motivo: string;
}
export type EstadoMedicao = "MEDIDO" | "NAO_ORDENHADO" | "PENDENTE";
export interface ResumoLeite {
  litros: number | null;
  esperadas: number;
  medidas: number;
  naoOrdenhadas: number;
  pendentes: number;
  resolvidas: number;
  completa: boolean;
}
export interface PosicaoOrdenha {
  posicaoId: string;
  nome: string;
  ordem: number;
  horario?: string | null;
}
export type CriterioColostro =
  | { tipo: "PRIMEIRA_ORDENHA" }
  | { tipo: "JANELA_DIAS"; dias: number; incluiD0: true };
export interface ConfiguracaoOrdenha {
  id: string | null;
  propriedadeId: number;
  vigenteDesde: string;
  inicial: boolean;
  fonteProducao?: "INDIVIDUAL" | "GERAL";
  intervaloIndividualQuantidade?: number;
  intervaloIndividualUnidade?: "DIAS" | "MESES";
  criterioColostro?: CriterioColostro | null;
  ordenhas: PosicaoOrdenha[];
}
export interface MedicaoLeite {
  confirmacaoEstoque?: null | {
    entradaId: string;
    produtoId: string;
    natureza: string;
  };
  id: string | null;
  posicaoId: string;
  estado: EstadoMedicao;
  litros: number | null;
  motivo: string | null;
  versao: number;
}
export interface AnimalFolhaLeite {
  participanteId: string | null;
  animalId: string;
  brinco: string;
  nome: string | null;
  finalidade: EvidenciaFinalidadeLeite;
  lactacaoId: string | null;
  localizacaoId: string;
  pendencias: string[];
  excluidoEm: string | null;
  motivoExclusao: string | null;
  medicoes: MedicaoLeite[];
  totais: ResumoLeite;
}
export interface FolhaLeite {
  id: string | null;
  propriedadeId: number;
  dataOperacional: string;
  versao: number;
  congelada: boolean;
  configuracao: ConfiguracaoOrdenha;
  sessoes: (PosicaoOrdenha & {
    entradasEstoque?: {
      entradaId: string;
      produtoId: string;
      natureza: string;
      quantidadeLitros: number | string;
      status: string;
    }[];
    id: string | null;
    versao: number;
    totais: ResumoLeite;
  })[];
  animais: AnimalFolhaLeite[];
  animaisExcluidos: AnimalFolhaLeite[];
  impedimentos: ImpedimentoProducaoLeite[];
  totais: ResumoLeite;
}
export interface MedicaoInput {
  animalId: string;
  posicaoId: string;
  estado: EstadoMedicao;
  litros: number | null;
  motivo: string | null;
}
export interface SalvarFolhaInput {
  chave: string;
  propriedadeId: number;
  dataOperacional: string;
  versaoEsperada: number;
  medicoes: MedicaoInput[];
  animaisAdicionar: string[];
  animaisExcluir: string[];
  motivoCorrecao?: string | null;
}
export interface ConfiguracaoInput {
  criterioColostro?: CriterioColostro | null;
  fonteProducao?: "INDIVIDUAL" | "GERAL";
  intervaloIndividualQuantidade?: number;
  intervaloIndividualUnidade?: "DIAS" | "MESES";
  chave: string;
  propriedadeId: number;
  vigenteDesde: string;
  ordenhas: PosicaoOrdenha[];
}
export interface CandidatoLeite {
  animalId: string;
  brinco: string;
  nome: string | null;
  finalidade: EvidenciaFinalidadeLeite;
  lactacaoId: string | null;
  pendencias: string[];
}
export interface CandidatosLeite {
  itens: CandidatoLeite[];
  total: number;
  pagina: number;
  porPagina: number;
  impedimentos: ImpedimentoProducaoLeite[];
  totalImpedidos?: number;
}
