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
export type AnimalReprodutivo = {
  animalId: string;
  brinco: string;
  nome: string | null;
  situacao: string;
  partos: number;
  tentativasCiclo: number;
  gestacao: Gestacao | null;
  restricoes: Restricao[];
};
export type FatoReprodutivo = {
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
};
export type PartoInput = FatoBase & {
  gestacaoId?: string;
  tipo: "NORMAL" | "DISTOCICO" | "ABORTO" | "NATIMORTO";
  crias: CriaInput[];
  iniciarLactacao?: boolean;
};
export async function reqV4<T>(
  path: string,
  body?: object,
  method = "POST",
): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho${path}`, {
    method: body ? method : "GET",
    headers: comPropriedade(body ? { "content-type": "application/json" } : {}),
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
export const obterReproducao = (animalId?: string) =>
  reqV4<PainelReprodutivo>(
    `/reproducao${animalId ? `?animalId=${encodeURIComponent(animalId)}` : ""}`,
  );
export const registrarTentativa = (input: TentativaInput) =>
  reqV4<FatoReprodutivo>("/reproducao/tentativas", input);
export const registrarAvaliacao = (input: AvaliacaoInput) =>
  reqV4<FatoReprodutivo>("/reproducao/avaliacoes", input);
export const registrarParto = (input: PartoInput) =>
  reqV4<FatoReprodutivo>("/reproducao/partos", input);
