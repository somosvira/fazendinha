import { reqV4, type AvaliacaoInput } from "./api";

export type ContextoAvaliacao =
  | "NOVILHA"
  | "APOS_TENTATIVA"
  | "GESTACAO_CONHECIDA"
  | "OUTRO";
export type EstadoItemAvaliacao =
  | "NAO_AVALIADO"
  | "INCONCLUSIVO"
  | "CONCLUSIVO";
export type ItemCatalogoAvaliacao = {
  codigo: string;
  rotulo: string;
  tipo:
    | "UTERO"
    | "OVARIO"
    | "DIAGNOSTICO"
    | "APTIDAO"
    | "RECONFIRMACAO"
    | "SEXAGEM"
    | "CONDICAO";
  campo?: string;
  contextos: ContextoAvaliacao[];
};
export type CondutaCatalogoAvaliacao = {
  codigo: string;
  rotulo: string;
  tipo:
    | "RETORNO"
    | "INDICAR_TENTATIVA"
    | "INDICAR_PROTOCOLO"
    | "NAO_PROSSEGUIR"
    | "OUTRO";
  exigeRevisao?: boolean;
};
export type CatalogoAvaliacao = {
  id: string;
  versao: number;
  tipoExameId: string;
  itens: ItemCatalogoAvaliacao[];
  condutas: CondutaCatalogoAvaliacao[];
};
export type AvaliacaoContextualInput = {
  catalogoId: string;
  itens: Array<{
    codigo: string;
    estado: EstadoItemAvaliacao;
    observacao?: string | null;
  }>;
  condutas: Array<{
    codigo: string;
    retornoEm?: string | null;
    destino?: string | null;
    revisaoEm?: string | null;
    observacao?: string | null;
  }>;
};
export type VinculoConclusaoInput = {
  demandaId: string;
  campo: "CONCLUSAO_GESTACIONAL" | "SEXO_FETAL" | "APTIDAO_REPRODUTIVA";
};
export type CamposAvaliacaoContextual = {
  avaliacaoContextual?: AvaliacaoContextualInput;
  vinculosConclusao?: VinculoConclusaoInput[];
  realizadoSemDG?: boolean;
  revisaoContextual?: string;
};
export type PreviaAvaliacaoContextual = {
  exame: {
    tipoExameId: string;
    data: string;
    resultado: string;
    sexoFetal?: string | null;
    resultadoAptidao?: string | null;
    gestacaoCriada: boolean;
  };
  itens: Array<
    ItemCatalogoAvaliacao & {
      estado: EstadoItemAvaliacao;
      observacao?: string | null;
    }
  >;
  condutas: Array<
    CondutaCatalogoAvaliacao & AvaliacaoContextualInput["condutas"][number]
  >;
  necessidades: Array<{
    id: string;
    finalidade: string;
    previstaPara: string | null;
    conclusaoCompativel: VinculoConclusaoInput["campo"] | null;
    acao: "RESOLVER" | "PRESERVAR";
  }>;
  necessidadesGeradas: Array<{
    finalidade: string;
    ocorrencia: number;
    previstaPara: string | null;
    origemAdocao?: string;
  }>;
  revisao: string;
};

export function consultarCatalogoAvaliacao(
  propriedadeId: number,
  contexto: ContextoAvaliacao,
) {
  return reqV4<{ catalogo: CatalogoAvaliacao | null; sugeridos: string[] }>(
    `/reproducao/avaliacoes/contexto/catalogo?contexto=${encodeURIComponent(contexto)}`,
    undefined,
    "GET",
    propriedadeId,
  );
}

export function conferirAvaliacaoContextual(
  input: AvaliacaoInput & CamposAvaliacaoContextual,
  propriedadeId: number,
) {
  return reqV4<PreviaAvaliacaoContextual>(
    "/reproducao/avaliacoes/contexto/previa",
    input,
    "POST",
    propriedadeId,
  );
}

export function contextoAvaliacao({
  gestacaoId,
  tentativaId,
  partos,
}: {
  gestacaoId?: string | null;
  tentativaId?: string | null;
  partos?: number;
}): ContextoAvaliacao {
  if (gestacaoId) return "GESTACAO_CONHECIDA";
  if (tentativaId) return "APOS_TENTATIVA";
  return partos === 0 ? "NOVILHA" : "OUTRO";
}
