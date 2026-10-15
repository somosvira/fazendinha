import { comPropriedade } from "../../../propriedadeScope";
import { RebanhoApiError } from "../api";

export type Gestacao = {
  animalId?: string;
  propriedadeId?: number | null;
  id: string;
  status: string;
  confirmadaEm?: string;
  encerradaEm?: string | null;
  sexoFetal?: string | null;
  previsaoParto?: string | null;
  tentativaId?: string | null;
};
export type Restricao = {
  id: string;
  animalId: string;
  tipo: string;
  motivo: string;
  data?: string;
  ate?: string | null;
  acoes?: string[];
  status?: string;
  propriedadeId?: number | null;
  doencaId?: string | null;
};
export type ContextoTemporalAnimal = {
  dataReferencia?: string;
  versaoContexto?: number;
  convencaoDel?: "D0";
  del?: number | null;
  situacaoProdutiva?: "LACTANTE" | "SECA" | "SEM_LACTACAO" | "NAO_INFORMADA";
  diasPosParto?: number | null;
  diasDesdeConfirmacao?: number | null;
  idadeGestacionalDias?: number | null;
  retencaoPlacenta?: boolean | null;
  pendenciasContexto?: string[];
};
export type PesoPartoInput =
  | { acao: "CORRIGIR"; vinculoId: string; data: string; pesoKg: number; observacao?: string | null }
  | { acao: "VINCULAR"; pesagemId: string }
  | { acao: "REGISTRAR"; data: string; pesoKg: number; observacao?: string | null }
  | { acao: "DESVINCULAR"; vinculoId: string; motivo: string };
export type OcorrenciaRetencaoInput =
  | { acao: "VINCULAR"; ocorrenciaId: string }
  | { acao: "CRIAR"; doencaId: string; inicio: string; observacao?: string | null }
  | { acao: "DESVINCULAR"; ocorrenciaId: string; motivo: string };
export type DadosEscoreParto = { data: string; valor: number; escalaMin: number; escalaMax: number; escalaDescricao?: string | null; responsavel?: string | null };
export type EscorePartoInput =
  | ({ acao: "REGISTRAR" } & DadosEscoreParto)
  | ({ acao: "SUBSTITUIR"; exameId: string; motivo: string } & DadosEscoreParto)
  | { acao: "ANULAR"; exameId: string; motivo: string };
export type CamposParto = {
  desfecho?: "NASCIMENTO" | "ABORTO" | null;
  induzido?: boolean | null;
  dificuldade?: boolean | null;
  assistenciaDescricao?: string | null;
  ocorridoEm?: string | null;
  horarioEstimado?: boolean;
  retencaoPlacenta?: boolean | null;
  responsavel?: string | null;
  observacao?: string | null;
};
export type AnimalReprodutivo = ContextoTemporalAnimal & {
  animalId: string;
  brinco: string;
  nome: string | null;
  situacao: string;
  categoria?: { id: string; nome: string } | null;
  lote?: { id: string; nome: string } | null;
  diasTentativa?: number | null;
  diasParto?: number | null;
  diasGestacao?: number | null;
  motivos?: string[];
  motivosInclusao?: string[];
  partos: number;
  tentativasCiclo: number;
  ultimaTentativa?: FatoReprodutivo | null;
  gestacao: Gestacao | null;
  restricoes: Restricao[];
};
export type FatoReprodutivo = CamposParto & {
  versao?: number;
  vinculosPesagem?: Array<{ id: string; sujeito: "MATRIZ" | "CRIA"; criaId: string | null; revogadoEm: string | null; pesagem: { id: string; data: string; pesoKg: number | string } }>;
  ocorrenciasRetencaoPlacenta?: Array<{ id: string; animalId: string; inicio: string; fim: string | null; status: string; doenca: { id: string; nome: string } }>;
  examesPosParto?: Array<{ id: string; data: string; status: string; resultados: Array<{ campo: string; valor: string | number | boolean }> }>;
  pesosMatriz?: Array<{ id: string; pesagemId: string; data: string; pesoKg: number | string; sujeito?: string }>;
  exame?: { id: string; finalidades: string[]; finalidadePrincipal: string | null; realizacao: string; responsavel: string | null; formatoSnapshot: { nome?: string; campos?: import("../sanidade/CamposExame").CampoExame[] }; resultados: Array<{ campo:string; valor:string | number | boolean; unidade:string | null }> } | null;
  id: string;
  animalId: string;
  data: string;
  tipo?: string;
  resultado?: string;
  motivo?: string | null;
  anotacaoOriginal?: string | null;
  sexoFetal?: string | null;
  origem?: string;
  origemMaterial?: string;
  status?: string;
  ciclo?: number;
  ordem?: number;
  gestacaoId?: string | null;
  materialId?: string | null;
  propriedadeId?: number | null;
  quantidade?: string | number | null;
  partidaId?: string | null;
  operacaoServicoId?: string | null;
  movimentoEstoqueId?: string | null;
  valorProdutoAtribuido?: string | null;
  valorServicoAtribuido?: string | null;
  responsavel?: string | null;
  observacao?: string | null;
  criadoEm?: string;
  criadoPorId?: number | null;
  geneticaSnapshot?: {
    mae?: { id: string; nome: string | null; externo: boolean };
    pai?: { id: string; nome: string | null; externo: boolean };
    receptoraId?: string | null;
    material?: { id: string; tipo: string; produtoId: string } | null;
    ultimoPartoId?: string | null;
  };
  crias?: Array<{
    id?: string;
    pesoKg?: number | string | null;
    filiacaoSnapshot?: { pesoKg?: number | null; brincoInformado?: string | null; nomeInformado?: string | null };
    animalId?: string | null;
    viva: boolean;
    sexo: string;
    brinco?: string | null;
    animal?: {
      id: string;
      brinco: string;
      identificacaoProvisoria: boolean;
      codigoProvisorio?: string | null;
    } | null;
  }>;
};
export type PainelReprodutivo = {
  animais: AnimalReprodutivo[];
  tentativas: FatoReprodutivo[];
  avaliacoes: FatoReprodutivo[];
  partos: FatoReprodutivo[];
  restricoes: Restricao[];
  lactacoes?: Array<{
    id: string;
    versao?: number;
    animalId: string;
    propriedadeId: number | null;
    inicio: string;
    encerradaEm: string | null;
    partoId?: string | null;
    motivoEncerramento?: string | null;
  }>;
  gestacoes?: Gestacao[];
  situacoesIniciais?: Array<
    FatoReprodutivo & { situacao: string; aptaDesde?: string | null }
  >;
  regrasSanitarias?: Array<{
    id: string;
    doencaId: string;
    acao: string;
    efeito: string;
    motivo: string;
    ativo: boolean;
    propriedadeId: number;
  }>;
  exposicoes?: Array<{
    id: string;
    loteId: string;
    inicio: string;
    fim: string | null;
    observacao: string | null;
    touroId?: string | null;
    touroExternoId?: string | null;
  }>;
};
export type FatoBase = {
  chave: string;
  propriedadeId: number;
  animalId: string;
  data: string;
};
export type TentativaInput = FatoBase & {
  tipo: "IA" | "TE" | "COBERTURA";
  origem: "ESTOQUE" | "SERVICO" | "DOCUMENTADA";
  materialId?: string;
  touroId?: string;
  touroExternoId?: string;
  quantidade?: number;
  partidaId?: string;
  operacaoServicoId?: string;
  responsavel?: string;
  observacao?: string;
  justificativaSemOrigem?: string;
  cienciaValidadeDesconhecida?: boolean;
  cienciaSanitaria?: boolean;
  documentacaoExcepcional?: boolean;
  motivoDocumentacaoExcepcional?: string;
};
export type AvaliacaoInput = FatoBase & {
  formatoExameHash?: string;
  finalidade?: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM";
  tipoExameId?: string;
  resultados?: Array<{ campo: string; valor: string | number | boolean }>;
  cienciaSanitaria?: boolean;
  resultado:
    | "POSITIVO"
    | "NEGATIVO"
    | "RECONFIRMACAO"
    | "SEXAGEM"
    | "INCONCLUSIVO"
    | "NAO_AVALIADO";
  tentativaId?: string;
  gestacaoId?: string;
  sexoFetal?: "F" | "M";
  conduta?: "AGUARDAR" | "IATF" | "DESCARTE";
  motivo?: string;
  anotacaoOriginal?: string;
  retornoEm?: string;
  previsaoParto?: string;
  motivoVinculoDesconhecido?: string;
};
export type CriaInput = {
  viva: boolean;
  sexo: "F" | "M";
  aptidao: "LEITE" | "CORTE";
  brinco?: string;
  nome?: string;
  loteId?: string;
  pesoKg?: number;
};
export type PartoInput = FatoBase & CamposParto & {
  escoreMatriz?: EscorePartoInput;
  gestacaoId?: string;
  tipo?: "NORMAL" | "DISTOCICO" | "ABORTO" | "NATIMORTO" | "NASCIMENTO";
  pesoMatriz?: PesoPartoInput;
  ocorrenciaRetencao?: OcorrenciaRetencaoInput;
  crias: CriaInput[];
  iniciarLactacao?: boolean;
};
export async function reqV4<T>(
  path: string,
  body?: object,
  method = "POST",
  propriedadeId?: number,
): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho${path}`, {
    method: body ? method : "GET",
    headers: { ...comPropriedade(body ? { "content-type": "application/json" } : {}),
      ...(propriedadeId ? { "X-Propriedade-Id": String(propriedadeId) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const resultado = await resposta.json().catch(() => ({}));
  if (!resposta.ok)
    throw new RebanhoApiError(
      resultado.error ?? `Erro HTTP ${resposta.status}`,
      resposta.status,
      resultado.code,
      resultado.campo,
    );
  return resultado as T;
}
export const obterReproducao = (animalId?: string, propriedadeId?: number) =>
  reqV4<PainelReprodutivo>(
    `/reproducao${animalId ? `?animalId=${encodeURIComponent(animalId)}` : ""}`,
    undefined, "GET", propriedadeId,
  );
export const registrarTentativa = (input: TentativaInput) =>
  reqV4<FatoReprodutivo>("/reproducao/tentativas", input);
export const registrarAvaliacao = (input: AvaliacaoInput) =>
  reqV4<FatoReprodutivo>("/reproducao/avaliacoes", input);
export const registrarParto = (input: PartoInput) =>
  reqV4<FatoReprodutivo>("/reproducao/partos", input);
