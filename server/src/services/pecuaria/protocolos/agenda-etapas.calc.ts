export type LinhaAgendaEtapa = {
  id:string; etapaId:string; momentoId:string|null; nome:string; ordem:number; animalId:string;
  previstaPara:Date; precisaoTemporal:string; fusoHorario:string|null; situacao:string;
};
const pendentes=new Set(["NAO_ATENDIDO","SEM_REGISTRO","ADIADO","REGULARIZACAO_PENDENTE"]);
/** Uma etapa pode ter vários procedimentos; o animal só está atendido ao concluir todos. */
export function agruparAgendaEtapas(linhas:LinhaAgendaEtapa[]) {
  const grupos=new Map<string,{id:string;dia:string;momentoId:string|null;nome:string;ordem:number;previstaPara:string;etapas:Set<string>;animais:Map<string,{atendido:boolean;pendente:boolean}>;contagens:Record<string,number>}>();
  for(const t of linhas){
    const dia=t.precisaoTemporal==="DIA"?t.previstaPara.toISOString().slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:t.fusoHorario??"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(t.previstaPara);
    const id=`${dia}:${t.momentoId??t.etapaId}`;
    const g=grupos.get(id)??{id,dia,momentoId:t.momentoId,nome:t.nome,ordem:t.ordem,previstaPara:t.previstaPara.toISOString(),etapas:new Set<string>(),animais:new Map<string,{atendido:boolean;pendente:boolean}>(),contagens:{}};
    g.etapas.add(t.etapaId);g.previstaPara=g.previstaPara<t.previstaPara.toISOString()?g.previstaPara:t.previstaPara.toISOString();
    const a=g.animais.get(t.animalId)??{atendido:true,pendente:false};a.atendido&&=t.situacao==="ATENDIDO";a.pendente||=pendentes.has(t.situacao);g.animais.set(t.animalId,a);
    g.contagens[t.situacao]=(g.contagens[t.situacao]??0)+1;grupos.set(id,g);
  }
  return [...grupos.values()].map(g=>({id:g.id,dia:g.dia,momentoId:g.momentoId,nome:g.nome,ordem:g.ordem,previstaPara:g.previstaPara,etapaIds:[...g.etapas],participantes:g.animais.size,atendidos:[...g.animais.values()].filter(a=>a.atendido).length,pendentes:[...g.animais.values()].filter(a=>a.pendente).length,procedimentos:Object.values(g.contagens).reduce((a,b)=>a+b,0),contagens:g.contagens})).sort((a,b)=>a.dia.localeCompare(b.dia)||a.ordem-b.ordem||a.id.localeCompare(b.id));
}
