export interface RetiradaOperacaoLeiteDTO {
  id: string;
  movimentoId: string;
  produtoId: string;
  data: string;
  quantidadeLitros: string;
  referencia: string;
  pontoColeta: string | null;
  horarioColeta: string | null;
  comprovantes: {
    id: string;
    nome: string;
    mimeType: string;
    tamanhoBytes: number;
    criadoEm: string;
  }[];
}
export interface FechamentoOperacaoLeiteDTO {
  id: string;
  versao: number;
  operacaoId: string;
  numeroOperacao: number;
  data: string;
  status: string;
  volumeReconhecido: string;
  precoUnitario: string | null;
  ajuste: string | null;
  motivoAjuste: string | null;
  valorTotal: string | null;
  motivo: string | null;
  amostras?: { amostraId: string; versaoAmostra: number; snapshot: import("./qualidade-types").AmostraQualidade }[];
  detalhes: {
    retiradaId: string;
    quantidadeReconhecida: string;
    motivoDiferenca: string | null;
  }[];
}
export interface OperacaoComercialLeiteDTO {
  id: string;
  propriedadeId: number;
  parceiroId: string;
  parceiroNome: string;
  inicio: string;
  fim: string;
  referencia: string;
  versao: number;
  status: "ABERTA" | "FECHADA";
  retiradoLitros: string;
  retiradas: RetiradaOperacaoLeiteDTO[];
  fechamento: FechamentoOperacaoLeiteDTO | null;
  historicoFechamentos: FechamentoOperacaoLeiteDTO[];
}
export interface CadastrosOperacaoLeite {
  parceiros: { id: string; nome: string }[];
  produtos: { id: string; nome: string }[];
}
