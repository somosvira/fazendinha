import type { DisposicaoAlertas, FiltrosAlertas, GrupoAlerta } from "./api";
const BASE="/pecuaria/rebanho/alertas";
export const rotulosSituacao: Record<string,string>={ ACOMPANHAMENTO:"Em acompanhamento",DADOS_INSUFICIENTES:"Dados insuficientes",PENDENTE:"Pendente",ATRASADO:"Atrasado",PROXIMO:"Próximo",PROGRAMADO:"Programado",REALIZADO:"Realizado",DISPENSADO:"Dispensado",ADIADO:"Adiado",REVISAO:"Necessita revisão",NECESSITA_REVISAO:"Necessita revisão",CONFERENCIA_INICIAL:"Conferência inicial",ENCERRADO:"Encerrado",INVALIDADO:"Invalidado",SUSPENSO:"Suspenso até revisão",PLANEJAMENTO_PENDENTE:"Planejamento pendente",RESOLVIDO:"Resolvido",RETIRADO:"Retirado do protocolo",BLOQUEADO:"Bloqueado" };
export const rotuloSituacao=(s:string)=>rotulosSituacao[s]??s;
const rotulosTipo: Record<string, string> = {
  IDADE: "Por idade",
  DATA_FIXA: "Por data fixa",
  SANITARIO_IDADE: "Por idade",
  SANITARIO_DATA_FIXA: "Por data fixa",
  PROGRAMACAO: "Programação sanitária",
  ETAPA_VENCIDA: "Etapa vencida",
  TENTATIVA_APOS_PREPARO: "Tentativa após preparo",
  AGENDAMENTO_INCOMPLETO: "Planejamento pendente",
  DG_VENCIDO: "Diagnóstico vencido",
  RECONFIRMACAO_VENCIDA: "Reconfirmação vencida",
  RETORNO_VENCIDO: "Retorno vencido",
  APTA_SEM_ENCAMINHAMENTO: "Apta sem encaminhamento",
  AVALIACAO_NECESSARIA: "Avaliação necessária",
  AVALIACAO_DESATUALIZADA: "Avaliação desatualizada",
  DISPOSITIVO_SEM_RETIRADA: "Retirada física pendente",
};
export const rotuloTipo = (tipo: string, produtor?: string) =>
  rotulosTipo[tipo] ?? (produtor === "reproducao" ? "Reprodução" : "Sanidade");

export const situacoesDoGrupo=(g:GrupoAlerta)=>Object.entries(g.situacoes).map(([s,n])=>`${n} ${rotuloSituacao(s).toLocaleLowerCase("pt-BR")}`).join(" · ");
export function filtrosDaUrl(): FiltrosAlertas { const p=new URLSearchParams(window.location.search);const d=p.get("disposicao");return {produtor:p.get("produtor")??"",tipo:p.get("tipo")??"",propriedadeId:Number(p.get("propriedadeId"))>0?Number(p.get("propriedadeId")):undefined,disposicao:window.location.pathname.endsWith("/historico")?"HISTORICO":["ATENCAO","PROXIMOS","PROGRAMADOS","HISTORICO"].includes(d??"")?d as DisposicaoAlertas:"ATENCAO",busca:p.get("busca")??"",loteId:p.get("loteId")??"",animalId:p.get("animalId")??"",regraId:p.get("regraId")??"",programacaoId:p.get("programacaoId")??"",situacao:p.get("situacao")??"",pagina:Math.max(1,Number(p.get("pagina"))||1),tamanho:20}; }
export function urlConsulta(f:FiltrosAlertas,path=BASE):string {const p=new URLSearchParams();for(const[k,v]of Object.entries(f))if(v!==undefined&&v!=="")p.set(k,String(v));return `${path}?${p}`;}
export function urlParticipantes(g:GrupoAlerta,f:FiltrosAlertas,retorno?:string):string {const p=new URLSearchParams(urlConsulta(f).split("?")[1]);p.set("cuidado",g.chave);p.set("retorno",retorno??urlConsulta(f,f.disposicao==="HISTORICO"?`${BASE}/historico`:BASE));return `${BASE}/participantes?${p}`;}
export function retornoAlertas():string {const p=new URLSearchParams(window.location.search),r=p.get("retorno");return r&&(/^\/pecuaria\/rebanho\/alertas(?:\/historico)?(?:\?|$)/.test(r)||/^\/pecuaria\/reproducao(?:\?|$)/.test(r))?r:BASE;}
