import { reqV4 } from "./api";
export type TipoAtividade =
  | "AVALIACAO_REPRODUTIVA"
  | "APLICACAO_SANITARIA"
  | "TAREFA_IATF"
  | "INICIAR_IATF"
  | "EXAME_SANITARIO"
  | "INICIAR_SANITARIO";
export type RascunhoVisita = {
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
  rascunho: RascunhoVisita | null;
  snapshot: {
    brinco?: string;
    nome?: string | null;
    motivos?: string[];
    gestacao?: {
      id: string;
      confirmadaEm?: string;
      encerradaEm?: string | null;
    } | null;
    tentativa?: { id: string; data: string; tipo: string } | null;
    ultimoParto?: { id: string; data: string; tipo: string } | null;
    restricoes?: Array<{ id: string; tipo: string; motivo: string }>;
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
  contexto?: Record<string, unknown> | null;
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
    snapshot: { atividades?: AtividadeVisita[] };
  }>;
};
export const listarVisitas = () => reqV4<Visita[]>("/visitas");
export const obterVisita = (id: string) => reqV4<Visita>(`/visitas/${id}`);
export const criarVisita = (input: {
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
) =>
  reqV4(
    `/visitas/${id}/participantes/${participanteId}/rascunho`,
    { propriedadeId, rascunho },
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
      dados?: Record<string, unknown>;
      status?: string;
      motivo?: string;
    }>;
  },
) => reqV4(`/visitas/${id}/atividades/${atividadeId}/confirmacao`, input);
export type SugestaoTarefa = {
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
  protocoloNome?: string;
  protocoloId?: string;
  participanteId?: string;
};
export type SugestoesVisita = {
  animais:
    | import("./api").AnimalReprodutivo[]
    | import("./api").PainelReprodutivo;
  participantesIatf?: Array<{
    id: string;
    animalId: string;
    programacaoId: string;
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
export const obterSugestoesVisita = (data: string) =>
  reqV4<SugestoesVisita>(`/visitas/sugestoes?data=${encodeURIComponent(data)}`);
