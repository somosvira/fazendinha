import type { CampoExame, ObservacaoExame } from "../sanidade/CamposExame";
export interface FormatoQualidade {
  id: string;
  nome: string;
  ativo: boolean;
  versaoFormato: number;
  versaoAnteriorId: string | null;
  formatoExameHash: string;
  formatoBloqueado: boolean;
  campos: CampoExame[];
}
export interface AmostraQualidade {
  id: string;
  propriedadeId: number;
  data: string;
  dataResultadoLaboratorial: string | null;
  dataRecebimentoLaudo: string | null;
  criadoEm: string;
  sujeito:
    | { tipo: "ANIMAL"; animalId: string }
    | { tipo: "COLETIVO"; origem: string; entradaId?: string };
  animal: { id: string; brinco: string; nome: string | null } | null;
  laudos: {
    id: string;
    nome: string;
    mimeType: string;
    tamanhoBytes: number;
    criadoEm: string;
    criadoPorId: number | null;
  }[];
  tipoExameId: string;
  formatoSnapshot: { nome: string; versao?: number; campos: CampoExame[] };
  resultados: ObservacaoExame[];
  realizacao: string;
  status: string;
  versao: number;
  responsavel: string | null;
  anotacaoOriginal: string | null;
}

export interface HistoricoQualidade {
  itens: {
    id: string;
    acao: string;
    em: string;
    autor: { nome: string } | null;
    motivo: string | null;
    antes: unknown;
    depois: unknown;
  }[];
  total: number;
  pagina: number;
  tamanho: number;
}
