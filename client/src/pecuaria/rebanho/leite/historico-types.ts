import type { ResumoLeite, EstadoMedicao, EvidenciaFinalidadeLeite } from "./types";
import type { CarenciaAnimal } from "../sanidade/api";
export type ContextoCarenciaLeite = { dataReferencia: string; disponibilidade: "FORA_DO_ESCOPO_ATUAL" } | {
  dataReferencia: string; disponibilidade: "DISPONIVEL"; leite: CarenciaAnimal["leite"];
  revisaoLeitePendente: boolean; revisaoAdministracaoPendente: boolean;
};
export interface DiaHistoricoProdutivo {
  participanteId: string; dataOperacional: string;
  finalidade: EvidenciaFinalidadeLeite;
  lactacao: { id: string; inicio: string; encerradaEm: string | null } | null;
  del: number | null; convencaoDel: "D0";
  excluidoEm: string | null; motivoExclusao: string | null;
  medicoes: { id: string | null; posicaoId: string; nomeOrdenha: string; estado: EstadoMedicao; litros: number | null; motivo: string | null }[];
  totais: ResumoLeite;
}
export interface AfericaoIndividual {
  participanteId: string; data: string; litros: number | null; completa: boolean; excluido: boolean;
  lactacaoId: string | null; comparabilidade: string; finalidade: string;
}
export interface HistoricoProdutivo {
  seriePeriodo?: AfericaoIndividual[];
  controleIndividual?: { quantidade: number; unidade: "DIAS" | "MESES"; ultimaAfericao: string | null; proximaAfericao: string | null };
  propriedadeId: number; animal: { id: string; brinco: string; nome: string | null };
  periodo: { inicio: string; fim: string }; itens: DiaHistoricoProdutivo[];
  total: number; pagina: number; tamanho: number; totaisPeriodo: ResumoLeite;
  coberturaPeriodo: { diasCalendario: number; diasComRegistro: number; diasSemRegistro: number };
  carenciaLeite: ContextoCarenciaLeite;
}
