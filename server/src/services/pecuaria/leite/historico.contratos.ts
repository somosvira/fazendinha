import type { EvidenciaFinalidadeLeiteDTO } from "./finalidade.calc.js";
import type { ResumoProducaoLeite } from "./producao.calc.js";
import type { MedicaoLeiteDTO } from "./contratos.js";
export type ContextoCarenciaLeiteDTO = {
  dataReferencia: string; disponibilidade: "FORA_DO_ESCOPO_ATUAL";
} | {
  dataReferencia: string; disponibilidade: "DISPONIVEL";
  leite: { estado: "NENHUMA" | "NAO_INFORMADO" | "NAO_APLICAVEL" } | { estado: "CONHECIDO"; ate: string; precisaoAproximada: boolean; prazoZero?: boolean };
  revisaoLeitePendente: boolean; revisaoAdministracaoPendente: boolean;
};
export interface DiaHistoricoProdutivoDTO {
  participanteId: string; dataOperacional: string; finalidade: EvidenciaFinalidadeLeiteDTO;
  lactacao: { id: string; inicio: string; encerradaEm: string | null } | null;
  del: number | null; convencaoDel: "D0";
  excluidoEm: string | null; motivoExclusao: string | null;
  medicoes: (Pick<MedicaoLeiteDTO, "id" | "posicaoId" | "estado" | "litros" | "motivo"> & { nomeOrdenha: string })[];
  totais: ResumoProducaoLeite;
}
export interface HistoricoProdutivoLeiteDTO {
  controlesDocumentais?: { id: string; tipo: string; inicio: string; fim: string; total: string | null; unidade: string; referenciaUnidade: string; parcelas: unknown; lactacaoId: string | null; versao: number; contexto: string; semEfeitoEstoqueFinanceiro: true }[];
  controleIndividual?: { quantidade: number; unidade: "DIAS" | "MESES"; ultimaAfericao: string | null; proximaAfericao: string | null };
  propriedadeId: number; animal: { id: string; brinco: string; nome: string | null };
  periodo: { inicio: string; fim: string }; itens: DiaHistoricoProdutivoDTO[];
  seriePeriodo: { participanteId: string; data: string; litros: number | null; completa: boolean; excluido: boolean; lactacaoId: string | null; comparabilidade: string; finalidade: string }[];
  total: number; pagina: number; tamanho: number; totaisPeriodo: ResumoProducaoLeite;
  coberturaPeriodo: { diasCalendario: number; diasComRegistro: number; diasSemRegistro: number };
  carenciaLeite: ContextoCarenciaLeiteDTO;
}
