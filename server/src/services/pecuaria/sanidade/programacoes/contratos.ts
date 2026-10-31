import type { JanelaProgramacao } from "./calendario.calc.js";
export interface EventoProgramacaoDTO extends JanelaProgramacao {
  nome: string; tipo: string; propriedadeId: number; ativo: boolean; produtoId: string | null; produtoNome: string | null;
  procedimento: string | null; sujeitoTipo: string; recorrencia: string; publico: unknown; fonte: string | null;
  observacao: string | null; revisao: number; pendenciasAtivacao: string[];
  previstos: number; atendidos: number; pendentes: number;
}
export interface ConsultaProgramacoesDTO {
  ano: number; mes: number | null; meses: { mes: number; eventos: EventoProgramacaoDTO[]; total: number }[];
  itens: EventoProgramacaoDTO[]; total: number; pagina: number; tamanho: number;
}
