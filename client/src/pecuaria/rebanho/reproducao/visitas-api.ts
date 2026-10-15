import { reqV4 } from "./api";
import type { ContextoTemporalAnimal } from "./api";
export type TipoAtividade =
  | "AVALIACAO_REPRODUTIVA"
  | "APLICACAO_SANITARIA"
  | "TAREFA_IATF"
  | "INICIAR_IATF"
  | "EXAME_SANITARIO"
  | "INICIAR_SANITARIO";
export type RascunhoVisita = {
  tipoExameId?: string;
  formatoExameHash?: string;
  resultados?: import("../sanidade/CamposExame").ObservacaoExame[];
  finalidade?: string;
  cienciaSanitaria?: boolean;
  participanteIatfId?: string;
  tentativaId?: string;
  gestacaoId?: string;
  motivoVinculoDesconhecido?: string;
  resultado?: string;
  sexoFetal?: string;
  conduta?: string;
  motivo?: string;
  anotacaoOriginal?: string;
  retornoEm?: string;
  status?: string;
  inicioEfetivo?: string;
  realizadaEm?: string;
  dados?: Record<string, unknown>;
};
export type ParticipanteVisita = {
  id: string;
  animalId: string;
  ordem: number;
  status: string;
  motivo?: string | null;
  rascunho: RascunhoVisita | null;
  versaoRascunho?: number;
  regularizacaoPendente?: boolean;
  historicoRegularizacao?: Array<{acao?: string; destinoConsumo?: string | null}>;
  snapshot: ContextoTemporalAnimal & {
    animalId?: string;
    sexo?: string;
    propriedadeId?: number;
    situacao?: string;
    categoria?: {id: string; nome: string} | null;
    aptidao?: string | null;
    papelReprodutivo?: string | null;
    papelReprodutivoEstado?: string;
    localizacaoId?: string | null;
    atualizadoEm?: string;
    del?: number | null;
    situacaoProdutiva?: "LACTANTE" | "SECA" | "SEM_LACTACAO" | "NAO_INFORMADA";
    lactacaoVigente?: Record<string, unknown> | null;
    ultimaLactacaoEncerrada?: Record<string, unknown> | null;
    diasPosParto?: number | null;
    diasDesdeConfirmacao?: number | null;
    idadeGestacionalDias?: number | null;
    baseIdadeGestacional?: string | null;
    diasTentativa?: number | null;
    diasParto?: number | null;
    diasGestacao?: number | null;
    diasAteRetorno?: number | null;
    retornoEm?: string | null;
    retornoInformado?: boolean;
    tarefaPlanejada?: { origem: "REPRODUTIVA" | "SANITARIA"; tarefa: SugestaoTarefa };
    partos?: number;
    tentativasCiclo?: number;
    brinco?: string;
    nome?: string | null;
    motivos?: string[];
    gestacao?: {
      id: string;
      confirmadaEm?: string;
      encerradaEm?: string | null;
    } | null;
    tentativa?: { id: string; data: string; tipo: string; geneticaSnapshot?: {pai?: {nome?: string | null}} } | null;
    ultimaTentativa?: { id: string; data: string; tipo: string; geneticaSnapshot?: {pai?: {nome?: string | null}} } | null;
    ultimoParto?: { id: string; data: string; tipo: string } | null;
    restricoes?: Array<{ id: string; tipo: string; motivo: string }>;
    restricoesSanitarias?: Array<Record<string, unknown>>;
    lote?: { id: string; nome: string } | null;
  };
  fatoTipo?: string | null;
  fatoId?: string | null;
  tarefaSanitariaId?: string | null;
  tarefaIatfId?: string | null;
};
export type AtividadeVisita = {
  id: string;
  nome: string;
  tipo: TipoAtividade;
  extra: boolean;
  participantes: ParticipanteVisita[];
  contexto?: (Record<string, unknown> & { inicioIatf?: { versao: 1; protocoloId: string; nomeProtocolo: string; versaoProtocolo: number; programacaoId?: string } }) | null;
};
export type Visita = {
  id: string;
  propriedadeId: number;
  nome: string;
  data: string;
  status: string;
  responsavel?: string | null;
  atividades: AtividadeVisita[];
  impressoes: Array<{
    id: string;
    criadoEm?: string;
    snapshot: { atividades?: AtividadeVisita[]; nome?: string; data?: string };
  }>;
};
export type VisitaResumo = Pick<Visita, "id" | "propriedadeId" | "nome" | "data" | "status" | "responsavel">;
export const listarVisitas = () => reqV4<VisitaResumo[]>("/visitas");
export const obterVisita = (id: string) => reqV4<Visita>(`/visitas/${id}`);
export const criarVisita = (input: {
  chave?: string;
  propriedadeId: number;
  data: string;
  nome: string;
  responsavel?: string;
}) => reqV4<Visita>("/visitas", input);
export const adicionarAtividade = (
  id: string,
  input: {
    propriedadeId: number;
    nome: string;
    tipo: TipoAtividade;
    extra?: boolean;
    contexto?: Record<string, unknown>;
    participantes: Array<{
      animalId: string;
      motivos?: string[];
      tarefaSanitariaId?: string;
      tarefaIatfId?: string;
    }>;
  },
) => reqV4<AtividadeVisita>(`/visitas/${id}/atividades`, input);
export const salvarRascunhoVisita = (
  id: string,
  participanteId: string,
  propriedadeId: number,
  rascunho: RascunhoVisita,
  versaoRascunho: number,
) =>
  reqV4<ParticipanteVisita>(
    `/visitas/${id}/participantes/${participanteId}/rascunho`,
    { propriedadeId, rascunho, versaoRascunho },
    "PUT",
  );
export const confirmarVisita = (
  id: string,
  atividadeId: string,
  input: {
    propriedadeId: number;
    chave: string;
    cienciaAlteracoes?: boolean;
    fingerprintPrevia?: string;
    itens: Array<{
      participanteId: string;
      versaoRascunho?: number;
      dados?: Record<string, unknown>;
      status?: string;
      motivo?: string;
    }>;
  },
) => reqV4(`/visitas/${id}/atividades/${atividadeId}/confirmacao`, input);
export type SugestaoTarefa = {
  previsaoPendente?: boolean;
  precisaoTemporal?: "DIA" | "HORA";
  planejadoSnapshot?: { etapa: {
    planoAplicacao?: { produtoId: string; dose: string; unidadeDose: string; via?: string | null };
    planoTentativa?: { tipo: "IA" | "TE"; materialId: string; quantidade: number };
    planoExame?: { tipoExameId: string };
    planoAvaliacao?: { tipoExameId?: string; tipo?: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM" } } } | null;
  id: string;
  animalId: string;
  nome?: string;
  tipo: string;
  previstaPara?: string;
  previstaEm?: string;
  animal?: { brinco: string; nome?: string | null };
  produtoId?: string;
  tipoAplicacaoId?: string;
  tipoExameId?: string;
  dose?: string;
  unidade?: string;
  via?: string | null;
  protocoloNome?: string;
  protocoloId?: string;
  participanteId?: string;
};
export type SugestoesVisita = {
  categorias?: Array<{id: string; nome: string}>;
  lotes?: Array<{id: string; nome: string}>;
  criterios?: Record<string, unknown>;
  retornos?: Array<{precisaoTemporal?: "DIA" | "HORA"; previsaoPendente?: boolean; origem: string; origemId: string | null; origemConsultavel?: boolean; animalId: string; data: string | null; status: string; propriedadeId: number; programacaoId?: string}>;
  animais:
    | import("./api").AnimalReprodutivo[]
    | import("./api").PainelReprodutivo;
  participantesIatf?: Array<{
    id: string;
    animalId: string;
    programacaoId: string;
    propriedadeId?: number;
    protocoloId?: string;
    protocoloNome?: string;
    protocoloVersao?: number;
    programacaoNome?: string;
    inicioPrevisto: string;
    inicioEfetivo: string | null;
  }>;
  tarefasSanitarias: SugestaoTarefa[];
  tarefasIatf: SugestaoTarefa[];
  protocolosSanitarios: Array<{ id: string; nome: string; versao: number }>;
  protocolosIatf: Array<{
    id: string;
    nome: string;
    versao?: number;
    animalId?: string;
    participanteId?: string;
  }>;
};
export const obterSugestoesVisita = (data: string, filtros: Record<string, string> = {}, propriedadeId?: number) =>
  reqV4<SugestoesVisita>(`/visitas/sugestoes?${new URLSearchParams({ data, ...Object.fromEntries(Object.entries(filtros).filter(([,v]) => v !== "")) })}`, undefined, "GET", propriedadeId);
