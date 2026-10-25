import type { EvidenciaFinalidadeLeiteDTO } from "./finalidade.calc.js";
import type { ResumoProducaoLeite } from "./producao.calc.js";
import type { CriterioColostro, PosicaoOrdenhaDTO } from "./schemas.js";

export interface ConfiguracaoOrdenhaDTO {
  id: string | null;
  propriedadeId: number;
  /** Na configuração inicial, 1900-01-01 é marco técnico, sem operação presumida. */
  vigenteDesde: string;
  inicial: boolean;
  fonteProducao?: "INDIVIDUAL" | "GERAL";
  intervaloIndividualQuantidade?: number;
  intervaloIndividualUnidade?: "DIAS" | "MESES";
  criterioColostro?: CriterioColostro | null;
  ordenhas: PosicaoOrdenhaDTO[];
}
export interface MedicaoLeiteDTO {
  id: string | null;
  posicaoId: string;
  estado: "MEDIDO" | "NAO_ORDENHADO" | "PENDENTE";
  litros: number | null;
  motivo: string | null;
  versao: number;
  confirmacaoEstoque: { entradaId: string; produtoId: string; natureza: string } | null;
}
export interface AnimalFolhaLeiteDTO {
  participanteId: string | null;
  animalId: string;
  brinco: string;
  nome: string | null;
  lactacaoId: string | null;
  localizacaoId: string;
  finalidade: EvidenciaFinalidadeLeiteDTO;
  pendencias: string[];
  excluidoEm: string | null;
  motivoExclusao: string | null;
  medicoes: MedicaoLeiteDTO[];
  totais: ResumoProducaoLeite;
}
export interface FolhaLeiteDTO {
  id: string | null;
  propriedadeId: number;
  dataOperacional: string;
  versao: number;
  congelada: boolean;
  configuracao: ConfiguracaoOrdenhaDTO;
  sessoes: (PosicaoOrdenhaDTO & { id: string | null; versao: number; entradasEstoque: { entradaId: string; produtoId: string; natureza: string; quantidadeLitros: number; status: string }[]; totais: ResumoProducaoLeite })[];
  animais: AnimalFolhaLeiteDTO[];
  animaisExcluidos: AnimalFolhaLeiteDTO[];
  impedimentos: { animalId: string; brinco: string; nome: string | null; codigo: string; motivo: string }[];
  totais: ResumoProducaoLeite;
}
