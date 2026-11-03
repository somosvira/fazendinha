import { comPropriedade } from "../../../propriedadeScope";
export type DisposicaoAlertas = "ATENCAO" | "PROXIMOS" | "PROGRAMADOS" | "HISTORICO";
export interface TotaisAlertas { cuidados: number; necessidades: number; animais: number }
export interface GrupoAlerta { chave: string; titulo: string; motivo: string; produtor: string; tipo: string; propriedadeId: number | null; produtoId: string | null; produtoNome: string | null; necessidades: number; animais: number; situacoes: Record<string, number>; primeiraData: string | null }
export interface CoberturaAlertas { estado: "ATUALIZADA" | "DESATUALIZADA" | "FALHA" | "NAO_AVALIADO"; diaCoberto: string | null; ultimaConclusao: string | null; erro: string | null }
export interface ConsultaAlertas { itens: GrupoAlerta[]; total: number; pagina: number; tamanho: number; totaisGerais: TotaisAlertas; totaisFiltrados: TotaisAlertas; cobertura: CoberturaAlertas; tiposDisponiveis: string[] }
export interface ParticipanteAlerta { id: string; necessidadeId: string; animalId: string; brinco: string; nome: string | null; loteId: string | null; loteNome: string | null; titulo: string; motivo: string; situacao: string; dataReferencia: string | null; dataAtencao: string | null; revisao: number; chaveAgrupamento: string; propriedadeId: number | null }
export interface ParticipantesAlertas { itens: ParticipanteAlerta[]; total: number; pagina: number; tamanho: number; totaisGerais: TotaisAlertas; totaisFiltrados: TotaisAlertas }
export interface FiltrosAlertas { disposicao?: DisposicaoAlertas; busca?: string; animalId?: string; loteId?: string; regraId?: string; programacaoId?: string; situacao?: string; pagina?: number; tamanho?: number; propriedadeId?: number }
export class AlertasApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); this.name="AlertasApiError"; } }
export async function requisicaoAlertas<T>(caminho: string, init?: RequestInit, signal?: AbortSignal, propriedadeId?: number): Promise<T> {
 const response=await fetch(`/api/pecuaria/rebanho/alertas${caminho}`, { ...init, signal, headers:{...comPropriedade(init?.body?{"Content-Type":"application/json"}:{}), ...(propriedadeId?{"X-Propriedade-Id":String(propriedadeId)}:{}),...init?.headers} });
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new AlertasApiError(body.error??"Não foi possível consultar os alertas",response.status,body.code);
 return body as T;
}
export function consultaParametros(filtros: FiltrosAlertas): string { const p=new URLSearchParams(); for(const [k,v]of Object.entries(filtros))if(v!==undefined&&v!=="")p.set(k,String(v));return p.toString(); }
export const consultarAlertas=(f: FiltrosAlertas,signal?:AbortSignal)=>requisicaoAlertas<ConsultaAlertas>(`?${consultaParametros(f)}`,undefined,signal,f.propriedadeId);
export const resumirAlertas=(f: FiltrosAlertas,signal?:AbortSignal)=>requisicaoAlertas<ConsultaAlertas>(`/resumo?${consultaParametros(f)}`,undefined,signal,f.propriedadeId);
export const consultarParticipantes=(chave:string,f:FiltrosAlertas,signal?:AbortSignal)=>requisicaoAlertas<ParticipantesAlertas>(`/cuidados/${encodeURIComponent(chave)}/participantes?${consultaParametros(f)}`,undefined,signal,f.propriedadeId);
export const avisarAlteracaoAlertas=()=>window.dispatchEvent(new Event("pecuaria:alertas-atualizados"));
export interface EventoHistoricoAlerta {id:string;revisao:number;comando:string;criadoEm:string;autorUsuarioId:number|null;autorTecnico:string|null;payload:{situacao?:string;motivo?:string;dataReferencia?:string|null;prazo?:string|null}}
export interface DetalheAlerta {
 eventos?:EventoHistoricoAlerta[];
 alertaId:string;necessidadeId?:string;revisao?:number;titulo:string;motivo:string;situacao:string;
 evidenciaDisparo: {titulo?:string;motivo?:string;dataReferencia?:string|null;prazo?:string|null;resumo?:{produtoNome?:string;regraNome?:string}};
 origem:{programacao?:{tipoExameId?:string|null;id:string;nome:string;precisao:"MES"|"DIA";dia:number|null;meses:number[]};estado:"DISPONIVEL"|"INDISPONIVEL"|"REMOVIDA";animal?:{id:string;brinco:string;nome:string|null;dataNascimento:string;nascimentoEstimado:boolean}|null;produto?:{id:string;nome:string;ativo:boolean}|null;regra?:{protocoloId?:string|null;id:string;nome:string;revisao:number;ativo:boolean;gatilho:string;orientacao:string|null};dataReferencia?:string|null;dataAtencao?:string|null;aplicacaoId?:string|null;exameId?:string|null;participacaoId?:string|null};
 acoes:string[];
}
export const consultarDetalhe=(id:string,propriedadeId?:number,signal?:AbortSignal)=>requisicaoAlertas<DetalheAlerta>(`/${encodeURIComponent(id)}`,undefined,signal,propriedadeId);
