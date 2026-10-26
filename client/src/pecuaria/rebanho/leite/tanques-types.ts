import type { ConfiguracaoOrdenha } from "./types";
export interface TanqueLeite {
  id: string;
  identidadeId: string;
  versao: number;
  propriedadeId: number;
  nome: string;
  fabricante: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  capacidadeLitros: number;
  vigenteDesde: string;
  ativo: boolean;
  referenciaTabela: string | null;
  tabelaConversao: { mm: number; litros: number }[];
}
export interface MedicaoGeral {
  id: string;
  sessaoId: string;
  tanque: TanqueLeite;
  litros: number;
  reguaMm: number | null;
  origemLitros: string;
  natureza: "COMERCIAL" | "NAO_COMERCIAL" | "COLOSTRO";
  animaisOrigem: string[];
  responsavel: string;
  observacao: string | null;
  versao: number;
  entradaId: string | null;
}
export interface ConsultaOrdenhasGerais {
  origensAutomaticas: { animalId: string; brinco: string; nome: string | null; del: number }[];
  configuracao: ConfiguracaoOrdenha;
  tanques: TanqueLeite[];
  medicoes: MedicaoGeral[];
  sessoes: {
    id: string | null;
    posicaoId: string;
    nome: string;
    ordem: number;
  }[];
  animais: { animalId: string; brinco: string; nome: string | null }[];
}
