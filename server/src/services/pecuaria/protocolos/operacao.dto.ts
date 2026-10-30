export type SituacaoOperacional = "ATENDIDO" | "NAO_ATENDIDO" | "SEM_REGISTRO" | "ADIADO" | "PREVISTO" | "REGULARIZACAO_PENDENTE" | "DISPENSADO" | "RETIRADO" | "ENCERRADO";
export type ContagensOperacao = { total: number; atendidos: number; pendentes: number; atrasadas: number; naoAtendidos: number; adiados: number; semRegistro: number; previstos: number; regularizacoes: number; encerradas: number; acompanhamentosPendentes?:number; animaisPendentes?:number; pendenciasOperacionais?:number };
export type PaginaOperacao<T> = { itens: T[]; total: number; pagina: number; porPagina: number; resumo?: ContagensOperacao };
export type AnimalOperacao = { id: string; brinco: string; nome: string | null };
export type CabecalhoOperacao = {
  id: string; modo: "INDIVIDUAL" | "COLETIVO"; tipo: string; nome: string;
  protocolo: { id: string; nome: string; versao: number }; propriedadeId: number | null; propriedadeContextoId?: number | null;
  inicioReferencia: string; precisaoTemporal: "DIA" | "HORA"; status: string;
  animal: AnimalOperacao | null; participantesTotal:number; podeEditarValores?:boolean; contagens: ContagensOperacao;
};
export type EtapaOperacao = { id: string; nome: string; ordem: number; tipo: string; diaRelativo: number; unidadeIntervalo: string; previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" | null; contagens: ContagensOperacao };
export type VinculoAtualOperacao = { tipo: "APLICACAO" | "EXAME" | "TENTATIVA" | "MANEJO"; id: string; origem: string };
export type ParticipanteOperacao = {
  contextoTentativa?: { iaPrevista: boolean | null; possuiTentativaVinculada: boolean };
  id:string;animalId:string;animal:AnimalOperacao;encerradoEm:string|null;motivoEncerramento:string|null;
  inicioPrevisto:string;inicioEfetivo:string|null;precisaoTemporal:"DIA"|"HORA";precisaoInicioEfetivo:"DIA"|"HORA"|null;
};
