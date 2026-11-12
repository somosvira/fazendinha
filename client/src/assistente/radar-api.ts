import { comPropriedade } from '../propriedadeScope';
export interface FonteRadar {titulo:string;url:string}
/** `valor` é o número da linha; `texto` explica de onde ele vem. */
export interface LeituraRadar {titulo:string;texto:string;fonte:FonteRadar;valor?:string}
export type UrgenciaRadar='atrasado'|'hoje'|'semana'|'depois';
// Urgência, prazo, quantidade e ação são opcionais: leituras em cache de versões anteriores não os têm.
export interface PrioridadeRadar {id:string;titulo:string;descricao:string;fonte:FonteRadar;pergunta:string;urgencia?:UrgenciaRadar;prazo?:string;quantidade?:{valor:number;unidade:string};acao?:string}
export interface RadarDTO {dia:string;geradoEm:string;escopo:{propriedadeId:number|null;nome:string};sintese:{modo:'ia'|'deterministica';texto:string};prioridades:PrioridadeRadar[];leitura:LeituraRadar[];cobertura:LeituraRadar[]}
export async function consultarRadar(atualizar=false,signal?:AbortSignal):Promise<RadarDTO> {
 const r=await fetch(`/api/assistente/radar${atualizar?'/atualizar':''}`,{method:atualizar?'POST':'GET',headers:comPropriedade(),signal,cache:'no-store'});
 if(!r.ok){const e=await r.json().catch(()=>null);throw new Error(e?.error??'Não foi possível abrir o Radar. Tente novamente.');}
 return r.json();
}
