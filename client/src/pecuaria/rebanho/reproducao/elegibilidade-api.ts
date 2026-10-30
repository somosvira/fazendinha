import { reqV4 } from "./api";
export type PapelElegibilidade = "NENHUM" | "DOADORA" | "RECEPTORA";
export type GrupoCriteriosAptidao = {
  idadeMinimaMeses: number | null; percentualPesoAdulto: number | null; pesoMinimoKg: number | null; eccMinimo: number | null;
  pesoAdultoReferenciaKg: number | null; validadePesoDias: number | null;
  precisaoPesoAceita: ("MEDIDO" | "ESTIMADO" | "INFORMADO")[];
  escalaEcc: { minimo: number; maximo: number } | null; validadeEccDias: number | null;
};
export type CriteriosAptidao = { vacas: GrupoCriteriosAptidao; novilhas: GrupoCriteriosAptidao; diasAvaliacaoPosParto: number | null };
export type ParametrosElegibilidade = {
  versao: 1 | 2;
  criteriosAptidao?: CriteriosAptidao;
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
export type DemandaManejo = {
  id: string; finalidade: "DIAGNOSTICO" | "RECONFIRMACAO"; ocorrencia: number;
  tentativaId: string | null; gestacaoId: string | null;
  dataReferencia: string; previstaPara: string | null; pendencias: string[];
};
export type ElegibilidadeNaData = {
  animalId: string;
  propriedadeId: number;
  dataReferencia: string;
  estado: "ELEGIVEL" | "NAO_ELEGIVEL" | "PENDENTE";
  baseElegivel: boolean | null;
  elegivel: boolean | null;
  demandasAcompanhamento?: DemandaManejo[];
  acompanhamentoAptidao?: { necessidadeId: string; fila: string; visitasAbertas: { id: string; nome: string; data?: string }[] } | null;
  aptidaoClinica?: { estado: "APTA" | "NAO_APTA" | "NAO_DETERMINADA"; exameId: string | null; data: string | null; retornoEm: string | null; resultado: string | null };
  necessidadeAptidao?: { politicaId?: string | null; politicaVersao?: number | null; necessidadeId: string; estado: "MANUAL" | "AVALIACAO_DEVIDA" | "PENDENCIA_DADOS" | "CRITERIOS_NAO_ATINGIDOS"; devidaDesde: string | null; pendencias: string[]; criteriosNaoAtingidos: string[]; evidenciaIds: string[] } | null;
  pevOriginalAte?: string | null; revisaoDecisaoNecessaria?: boolean;
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
  motivo?: string;
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
  anteciparPev?: boolean; exameAptidaoId?: string; acaoLiberada?: "PROTOCOLO" | "IA" | "TE";
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
  EXAME_ORIGEM_INVALIDO: "O exame que fundamentou este acompanhamento está inválido; confira a evidência de origem antes de registrar a resolução.",
  DATA_PARTO_NAO_COMPROVADA: "Há parto anterior comprovado, mas falta sua data para calcular a avaliação pós-parto.",
  CLASSE_REPRODUTIVA_CONFLITANTE: "A classificação informada conflita com o histórico de partos; confira a evidência.",
  CLASSE_REPRODUTIVA_NAO_COMPROVADA: "Confirme o histórico de partos para aplicar os critérios de vacas ou novilhas.",
  DECISAO_APTIDAO_NECESSARIA: "A avaliação e os critérios não liberam reprodução. Registre decisão individual após toque apto.",
  EXAME_ALTERADO_REVISAR_DECISAO: "O exame foi corrigido, anulado ou sucedido por outro toque. Revise a decisão antes de nova intervenção.",
  PESO_AUSENTE_OU_VENCIDO: "Pesagem ausente, vencida ou sem a precisão aceita nesta política.",
  ECC_AUSENTE_VENCIDO_OU_ESCALA_INCOMPATIVEL: "ECC ausente, vencido ou em escala diferente da política.",
  NASCIMENTO_NAO_COMPROVADO: "Data de nascimento não comprovada.",
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

export const registrarToqueAptidao = (input: { chave: string; animalId: string; propriedadeId: number; data: string; resultado: "APTO" | "NAO_APTO" | "INCONCLUSIVO"; retornoEm?: string | null; responsavel: string; observacao?: string | null }) =>
  reqV4("/reproducao/toques-aptidao", input, "POST", input.propriedadeId);
export const corrigirToqueAptidao = (id: string, input: { chave: string; propriedadeId: number; motivo: string; resultado?: "APTO" | "NAO_APTO" | "INCONCLUSIVO"; retornoEm?: string | null; anular?: boolean }) =>
  reqV4(`/reproducao/toques-aptidao/${id}/corrigir`, input, "POST", input.propriedadeId);

export const consultarManejoAptidao = (propriedadeId: number, data: string) => reqV4<{ propriedadeId: number; dataReferencia: string; itens: ElegibilidadeNaData[] }>(`/reproducao/filas-aptidao?${new URLSearchParams({ propriedadeId: String(propriedadeId), data })}`, undefined, "GET", propriedadeId);
