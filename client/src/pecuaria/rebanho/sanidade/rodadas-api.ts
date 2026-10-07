import { reqSanidade } from "./api";

export type PaginaSanitaria<T> = { itens: T[]; total: number; pagina: number; porPagina: number };
export type ParametrosTarefa = { tipo: "APLICACAO" | "EXAME"; produtoId?: string; produtoNomeSnapshot?: string; tipoAplicacaoId?: string; tipoAplicacaoNomeSnapshot?: string; dose?: string; unidade?: string; via?: string; tipoExameId?: string; tipoExameNomeSnapshot?: string };
export type TarefaRodada = { id: string; etapaId: string; execucaoId: string; previstaPara: string; situacao: string; propriedadeAtualId?: number | null; propriedadePrevista?: { id: number; nome: string } | null; propriedadeAtual?: { id: number; nome: string } | null; aplicacoes?: Array<{ id: string; status: string; data: string; aplicadaEm: string | null; dose: string; unidadeDose: string | null; nomeProdutoAplicado: string; propriedadeId: number }>; exames?: Array<{ id: string; status: string; data: string; propriedadeId: number; formatoSnapshot?: { nome?: string } }>; parametros: ParametrosTarefa; execucao: { animalId: string; propriedadeId: number; animal?: { id: string; brinco: string; nome: string | null }; protocolo: { nome: string; versao: number } } };
export type ContagensRodada = { total: number; pendentes: number; realizadas: number; dispensadas: number; atrasadas: number; canceladas?: number };
export type RodadaSanitaria = { id: string; nome: string; propriedadeId: number; protocoloId: string; inicioReferencia: string; protocolo: { id: string; nome: string; versao: number }; participantes?: number; contagens?: ContagensRodada };
export type ParticipanteRodada = { id: string; animalId: string; inicio: string; propriedadeAtualId?: number | null; propriedadeContextoId?: number | null; canceladaEm: string | null; motivoCancelamento?: string | null; animal: { id: string; brinco: string; nome: string | null }; contagens?: ContagensRodada };
export type EtapaRodada = { id: string; ordem: number; diaRelativo: number; tipo: "APLICACAO" | "EXAME"; parametros?: ParametrosTarefa; contagens: ContagensRodada; contagensFiltradas?: ContagensRodada };
export type ItemEntradaRodada = { animalId: string; inicio?: string; justificativaInicio?: string; confirmarSobreposicao?: boolean; justificativaSobreposicao?: string };
export type CriarRodadaInput = { chave: string; propriedadeId: number; nome: string; protocoloId: string; inicioReferencia: string; itens: ItemEntradaRodada[] };
export type PreviaRodada = { itens: Array<{ animalId: string; inicio: string; tarefas: Array<{ etapaId: string; previstaPara: string; parametros: ParametrosTarefa }>; avisos?: string[] }>; avisos?: string[] };
export function consultaRodadas(filtros: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return p.size ? `?${p}` : "";
}
export const listarRodadas = (filtros: Record<string, string | number | undefined>) => reqSanidade<PaginaSanitaria<RodadaSanitaria>>(`/rodadas${consultaRodadas(filtros)}`);
export const consultarRodada = (id: string, propriedadeId?: number) => reqSanidade<RodadaSanitaria>(`/rodadas/${encodeURIComponent(id)}${consultaRodadas({ propriedadeId })}`);
export const renomearRodada = (id: string, body: { chave: string; propriedadeId: number; nome: string }) => reqSanidade<RodadaSanitaria>(`/rodadas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
export const listarParticipantesRodada = (id: string, filtros: Record<string, string | number | undefined>) => reqSanidade<PaginaSanitaria<ParticipanteRodada>>(`/rodadas/${encodeURIComponent(id)}/participantes${consultaRodadas(filtros)}`);
export const listarEtapasRodada = (id: string, filtros: Record<string, string | number | undefined>) => reqSanidade<PaginaSanitaria<EtapaRodada>>(`/rodadas/${encodeURIComponent(id)}/etapas${consultaRodadas(filtros)}`);
export const listarTarefasEtapa = (id: string, etapaId: string, filtros: Record<string, string | number | undefined>) => reqSanidade<PaginaSanitaria<TarefaRodada>>(`/rodadas/${encodeURIComponent(id)}/etapas/${encodeURIComponent(etapaId)}/tarefas${consultaRodadas(filtros)}`);
export const preverRodada = (body: CriarRodadaInput) => reqSanidade<PreviaRodada>("/rodadas/previa", { method: "POST", body: JSON.stringify(body) });
export const criarRodada = (body: CriarRodadaInput) => reqSanidade<RodadaSanitaria>("/rodadas", { method: "POST", body: JSON.stringify(body) });
export const adicionarParticipantes = (id: string, body: { propriedadeId: number; chave: string; itens: ItemEntradaRodada[] }) => reqSanidade(`/rodadas/${encodeURIComponent(id)}/participantes`, { method: "POST", body: JSON.stringify(body) });
export const preverParticipantes = (id: string, body: { propriedadeId: number; chave: string; itens: ItemEntradaRodada[] }) => reqSanidade<PreviaRodada>(`/rodadas/${encodeURIComponent(id)}/participantes/previa`, { method: "POST", body: JSON.stringify(body) });
export const removerParticipante = (id: string, execucaoId: string, body: { propriedadeId: number; chave: string; motivo: string }) => reqSanidade(`/rodadas/${encodeURIComponent(id)}/participantes/${encodeURIComponent(execucaoId)}/remocao`, { method: "POST", body: JSON.stringify(body) });
