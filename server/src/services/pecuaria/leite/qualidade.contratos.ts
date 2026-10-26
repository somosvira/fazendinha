import type { CampoExame } from "../exames/formatos.js";
import type { RegistrarQualidadeInput } from "./qualidade.schemas.js";

export interface FormatoQualidadeLeiteDTO {
  /** A identidade pública do formato é a do TipoExame compartilhado. */
  id: string; nome: string; ativo: boolean; tipoResultado: "MULTIPLO";
  campos: CampoExame[]; unidade: null; opcoes: null;
  versaoFormato: number; versaoAnteriorId: string | null;
  formatoExameHash: string; formatoBloqueado: boolean;
}
export interface ResultadoQualidadeDTO {
  id: string; campo: string; valor: string | number | boolean; unidade: string | null;
  criadoEm: string; criadoPorId: number | null;
}
export interface LaudoQualidadeDTO {
  id: string; nome: string; mimeType: string; tamanhoBytes: number;
  criadoEm: string; criadoPorId: number | null;
}
export interface AmostraQualidadeLeiteDTO {
  id: string; propriedadeId: number; data: string; versao: number;
  dataResultadoLaboratorial: string | null; dataRecebimentoLaudo: string | null;
  sujeito: RegistrarQualidadeInput["sujeito"];
  animal: { id: string; brinco: string; nome: string | null } | null;
  exameAnimalId: string | null; tipoExameId: string;
  formatoSnapshot: { nome: string; tipoResultado: "MULTIPLO"; versao: number; campos: CampoExame[] };
  resultados: ResultadoQualidadeDTO[];
  realizacao: "COLETA_REGISTRADA" | "REALIZADO";
  status: "VALIDO" | "ANULADO"; motivoAnulacao: string | null;
  responsavel: string | null; anotacaoOriginal: string | null;
  criadoEm: string; criadoPorId: number | null;
  laudos: LaudoQualidadeDTO[];
}
export interface ListaQualidadeLeiteDTO {
  propriedadeId: number; itens: AmostraQualidadeLeiteDTO[]; total: number; pagina: number; tamanho: number;
}
