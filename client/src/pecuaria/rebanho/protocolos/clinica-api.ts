import { reqProtocolo } from "./api";
import type { CampoExame, ObservacaoExame } from "../sanidade/CamposExame";
import type { PreviaExecucao } from "../sanidade/PreviaExecucao";
export type TipoClinico = "EXAME" | "TENTATIVA" | "AVALIACAO";
export type OpcaoClinica = "TIPO_EXAME" | "MATERIAL" | "PARTIDA" | "SERVICO" | "TENTATIVA" | "GESTACAO" | "REPRODUTOR";
export type FormatoClinico = { tipoResultado: "TEXTO" | "NUMERO" | "OPCAO" | "MULTIPLO"; unidade?: string | null; opcoes?: string[] | null; campos?: CampoExame[]; versaoFormato?: number; formatoExameHash?: string };
export type EscolhaClinica = { id: string; nome: string; tipo?: string; data?: string; validade?: string | null; formatoExameHash?: string; versaoFormato?: number; tipoResultado?: FormatoClinico["tipoResultado"]; unidade?: string | null; opcoes?: string[] | null; campos?: CampoExame[]; produto?: { unidade: string; rastrearPartidas?: boolean }; externo?: boolean };
export type AcompanhamentoClinico = { id: string; estado: string; finalidade: string; tentativaId?: string | null; gestacaoId?: string | null; previstaPara?: string | null; versao: number };
export type PaginaClinica<T> = { itens: T[]; total: number; pagina: number; porPagina: number; acompanhamento?: AcompanhamentoClinico | null };
export type DadosClinicos = {
  momento: string; responsavel: string; tipoExameId: string; formato?: FormatoClinico;
  informarResultado: boolean; resultado: string; resultados: ObservacaoExame[]; valorResultado: string; observacao: string; motivoDesvio: string;
  tipoTentativa: "IA" | "TE" | "COBERTURA"; origem: "ESTOQUE" | "SERVICO" | "DOCUMENTADA";
  materialId: string; partidaId: string; operacaoServicoId: string; quantidade: string; justificativaSemOrigem: string;
  cienciaValidadeDesconhecida: boolean; documentacaoExcepcional: boolean; motivoDocumentacaoExcepcional: string;
  touroId: string; touroExternoId: string; tentativaId: string; gestacaoId: string; sexoFetal: string; finalidade: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM";
  motivoVinculoDesconhecido: string; retornoEm: string; previsaoParto: string; cienciaSanitaria: boolean; cienciaRecalendarioLegado: boolean;
  reprodutorExterno: boolean;
  demandaAcompanhamentoId?: string; reavaliacao?: boolean;
};
export type ItemClinico = { tarefaId: string; animalId: string; propriedadeId: number; tipo: TipoClinico; data: string; realizadaEm: string; [campo: string]: unknown };
export type EntradaClinica = { versao: 1; propriedadeId: number; itens: ItemClinico[] };
export type PreviaClinica = { fingerprint: string; temDesvios: boolean; tarefas: PaginaClinica<PreviaExecucao["itens"][number] & { inicioLegado: { exigeCiencia: boolean; total: number } }>; consumos: PaginaClinica<PreviaExecucao["consumos"][number]> };
export type ReciboClinico = PaginaClinica<{ tarefaId: string; animalId: string; id: string; tipo: TipoClinico; exameId?: string; demandaAcompanhamentoId?: string | null; acompanhamentoPendente?: boolean }> & { chave: string; versao: 1 };
export function obterOpcoesClinicas(tarefaId: string, propriedadeId: number, opcao: OpcaoClinica, pagina: number, busca: string, selecionadoId?: string, materialId?: string, tipoTentativa?: "IA" | "TE", externo?: boolean) {
  const q = new URLSearchParams({ opcao, pagina: String(pagina), porPagina: "10", busca });
  if (selecionadoId) q.set("selecionadoId", selecionadoId);
  if (opcao === "PARTIDA" && materialId) q.set("materialId", materialId);
  if (opcao === "MATERIAL" && tipoTentativa) q.set("tipoTentativa", tipoTentativa);
  if (opcao === "REPRODUTOR") q.set("externo", String(externo ?? true));
  return reqProtocolo<PaginaClinica<EscolhaClinica>>(`/tarefas/${encodeURIComponent(tarefaId)}/opcoes-clinicas?${q}`, propriedadeId);
}
