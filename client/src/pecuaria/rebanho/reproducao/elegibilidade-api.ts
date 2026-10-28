import { reqV4 } from "./api";
export type PapelElegibilidade = "NENHUM" | "DOADORA" | "RECEPTORA";
export type ParametrosElegibilidade = {
  versao: 1;
  metodologia: "IDEAGRI_IILB_BASE_V1";
  pevPrimiparasDias: number;
  pevMultiparasDias: number;
  aborto: "PEV_CONFIGURADO" | "LIBERACAO_EXPLICITA";
  pevAposAbortoDias: number | null;
  descarte: "EXCLUIR" | "INCLUIR";
  restricoes: "EXCLUIR" | "APENAS_ALERTAR";
  perdaGestacional: "EXIGE_LIBERACAO" | "RETOMAR_CICLO";
  papeisIncluidos: PapelElegibilidade[];
};
export type PoliticaElegibilidade = {
  id: string;
  versao: number;
  vigenteDesde: string;
  parametros: ParametrosElegibilidade;
};
export type ElegibilidadeNaData = {
  animalId: string;
  propriedadeId: number;
  dataReferencia: string;
  estado: "ELEGIVEL" | "NAO_ELEGIVEL" | "PENDENTE";
  baseElegivel: boolean | null;
  elegivel: boolean | null;
  aptaDesde: string | null;
  ciclo: {
    chaveCiclo: string;
    inicioCiclo: string;
    partoId: string | null;
  } | null;
  vinculoCicloId: string | null;
  politicaId: string | null;
  politicaVersao: number | null;
  metodologia: string;
  decisaoId: string | null;
  motivos: string[];
  alertas: string[];
  restricaoIds: string[];
};
export const listarPoliticas = (propriedadeId: number) =>
  reqV4<PoliticaElegibilidade[]>(
    `/reproducao/politicas-elegibilidade?propriedadeId=${propriedadeId}`,
    undefined,
    "GET",
    propriedadeId,
  );
export const criarPolitica = (input: {
  chave: string;
  propriedadeId: number;
  vigenteDesde: string;
  parametros: ParametrosElegibilidade;
}) =>
  reqV4<PoliticaElegibilidade>(
    "/reproducao/politicas-elegibilidade",
    input,
    "POST",
    input.propriedadeId,
  );
export const consultarElegibilidade = (
  animalId: string,
  propriedadeId: number,
  data: string,
) =>
  reqV4<ElegibilidadeNaData>(
    `/reproducao/animais/${animalId}/elegibilidade?${new URLSearchParams({ propriedadeId: String(propriedadeId), data })}`,
    undefined,
    "GET",
    propriedadeId,
  );
export const vincularPolitica = (input: {
  chave: string;
  propriedadeId: number;
  animalId: string;
  partoId?: string;
  situacaoInicialId?: string;
}) =>
  reqV4(
    "/reproducao/vinculos-politica-ciclo",
    input,
    "POST",
    input.propriedadeId,
  );
export const decidirElegibilidade = (input: {
  chave: string;
  propriedadeId: number;
  vinculoCicloId: string;
  data: string;
  tipo: "LIBERAR" | "BLOQUEAR" | "RETOMAR_POLITICA";
  aptaDesde: string | null;
  motivo: string;
}) =>
  reqV4(
    "/reproducao/decisoes-elegibilidade",
    input,
    "POST",
    input.propriedadeId,
  );
export const anularDecisao = (
  id: string,
  input: { chave: string; propriedadeId: number; motivo: string },
) =>
  reqV4(
    `/reproducao/decisoes-elegibilidade/${id}/anular`,
    input,
    "POST",
    input.propriedadeId,
  );
const motivos: Record<string, string> = {
  INICIO_CICLO_NAO_COMPROVADO: "Não há parto ou situação inicial que comprove o início do acompanhamento.",
  LIBERACAO_NAO_COMPROVADA: "Liberação reprodutiva ainda não comprovada.",
  DISPONIBILIDADE_NO_CORTE_NAO_COMPROVADA: "Disponibilidade para reprodução não comprovada na data consultada.",
  RESTRICAO_NO_CORTE: "Há impedimento de elegibilidade na data consultada.",
  POLITICA_CICLO_NAO_CONGELADA:
    "O acompanhamento precisa de vínculo explícito com a política.",
  POLITICA_AUSENTE_NO_INICIO_CICLO:
    "Não havia política vigente no início deste acompanhamento.",
  CICLO_DESCONHECIDO:
    "Não há parto ou situação inicial que comprove o início do acompanhamento.",
  LIBERACAO_EXPLICITA_NECESSARIA:
    "É necessária uma liberação individual com data.",
  EM_ESPERA_PARA_LIBERACAO: "Ainda está no período de espera.",
  DIAGNOSTICO_PENDENTE: "Diagnóstico pendente.",
  CONCEPCAO_ESTIMADA_NAO_INFORMADA:
    "Informe a concepção estimada para ponderar tentativas anteriores sem diagnóstico.",
  ELEGIBILIDADE_PENDENTE: "Há animais com elegibilidade pendente.",
  TENTATIVAS_SEM_DIAGNOSTICO:
    "Há tentativas sem diagnóstico; ausência de resultado não significa negativo.",
  SEM_DENOMINADOR_ELEGIVEIS: "Não há denominador de elegíveis.",
  SEM_DENOMINADOR_CONCEPCAO:
    "Não há tentativas com resultado para calcular concepção.",
  JANELA_SEM_PERIODO_COMPLETO:
    "A janela não contém um período completo de 21 dias.",
  PAPEL_DESCONHECIDO: "Papel reprodutivo não informado.",
};
export const descreverMotivo = (codigo: string) =>
  motivos[codigo] ?? codigo.toLocaleLowerCase("pt-BR").replaceAll("_", " ");
