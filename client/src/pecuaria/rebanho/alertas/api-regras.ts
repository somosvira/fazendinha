import { listarPropriedades } from "@/api/propriedades";
import { listarProdutos } from "@/estoque/api";
import { listarTiposAplicacao,reqSanidade } from "../sanidade/api";
import { requisicaoAlertas } from "./api";
export interface RegraAlertaInput {nome:string;produtoId:string|null;protocoloId:string|null;tipoAplicacaoId:string|null;cuidado:string|null;gatilho:"IDADE"|"DATA_FIXA";idadeMeses:number|null;dataFixa:string|null;propriedadeIds:number[];sexo:"F"|"M"|null;idadeMinimaMeses:number|null;idadeMaximaMeses:number|null;antecedenciaDias:number;prazoDias:number;vigencia:string;orientacao:string|null}
export interface RegraAlerta extends RegraAlertaInput {id:string;ativo:boolean;revisao:number;adocao:string|null}
export interface PreviaRegra {regra:RegraAlerta;base:string;revisao:number;total:number;pagina:number;tamanho:number;totais:Record<string,number>;itens:{animalId:string;brinco:string;nome:string|null;nascimentoEstimado:boolean;dataReferencia:string|null;situacao:string;candidatas:{id:string;data:string}[]}[]}
export type DecisaoAbertas={destinoAbertas:"MANTER"|"ENCERRAR";motivo:string};
const post=<T>(url:string,body:unknown,site?:number)=>requisicaoAlertas<T>(url,{method:"POST",body:JSON.stringify(body)},undefined,site);
export const listarRegrasAlertas=(site?:number,signal?:AbortSignal)=>requisicaoAlertas<RegraAlerta[]>("/regras",undefined,signal,site);
export const criarRegraAlerta=(regra:RegraAlertaInput,site?:number)=>post<RegraAlerta>("/regras",regra,site);
export const revisarRegraAlerta=(regra:RegraAlertaInput,id:string,revisao:number,decisao:DecisaoAbertas,site?:number)=>post<RegraAlerta>(`/regras/${encodeURIComponent(id)}/revisao`,{regra,revisao,...decisao},site);
export const consultarPreviaRegra=(id:string,pagina=1,site?:number)=>post<PreviaRegra>(`/regras/${encodeURIComponent(id)}/previa`,{pagina,tamanho:20},site);
export const ativarRegraAlerta=(previa:PreviaRegra,site?:number)=>post<RegraAlerta>(`/regras/${encodeURIComponent(previa.regra.id)}/ativacao`,{base:previa.base,revisao:previa.revisao},site);
export const inativarRegraAlerta=(regra:RegraAlerta,decisao:DecisaoAbertas,site?:number)=>post<RegraAlerta>(`/regras/${encodeURIComponent(regra.id)}/inativacao`,{revisao:regra.revisao,...decisao},site);
export async function listarCatalogosRegras(site?:number){const [produtos,sitios,tipos,protocolos]=await Promise.all([listarProdutos({ativo:true},site),listarPropriedades(),listarTiposAplicacao(site),reqSanidade<Array<{id:string;nome:string;versao:number;ativo:boolean;publicado:boolean}>>("/protocolos",undefined,site)]);return{protocolos:protocolos.filter(p=>p.ativo&&p.publicado),produtos:produtos.filter(p=>p.usoSanitario&&p.perfilSanitario),sitios:sitios.filter(s=>s.ativo),tipos:tipos.filter(t=>t.ativo)};}
export type CatalogosRegras=Awaited<ReturnType<typeof listarCatalogosRegras>>;
export function regraParaFormulario(r:RegraAlerta):RegraAlertaInput{return{nome:r.nome,produtoId:r.produtoId,protocoloId:r.protocoloId,tipoAplicacaoId:r.tipoAplicacaoId,cuidado:r.cuidado,gatilho:r.gatilho,idadeMeses:r.idadeMeses,dataFixa:r.dataFixa?.slice(0,10)??null,propriedadeIds:[...r.propriedadeIds],sexo:r.sexo,idadeMinimaMeses:r.idadeMinimaMeses,idadeMaximaMeses:r.idadeMaximaMeses,antecedenciaDias:r.antecedenciaDias,prazoDias:r.prazoDias,vigencia:r.vigencia.slice(0,10),orientacao:r.orientacao};}
