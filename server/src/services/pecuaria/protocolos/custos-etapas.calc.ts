import { Prisma } from "@prisma/client";
import { consolidarCustos, type ComponenteCusto } from "../custos/custos.calc.js";

export type TarefaCustoEtapa = {
  etapaId: string; momentoId: string | null; nome: string; ordem: number;
  animalId: string; atendida: boolean; fontes: string[];
};
/** Deduplica a origem antes de agrupar: um pacote ou vínculo não vira duas despesas. */
export function agruparCustosEtapas(tarefas: TarefaCustoEtapa[], componentes: ComponenteCusto[], verValores: boolean) {
  const grupos = new Map<string, { id:string; nome:string; ordem:number; momentoId:string|null; etapas:Set<string>; animais:Map<string,boolean>; componentes:ComponenteCusto[] }>();
  const origens = new Map<string, Set<string>>();
  for (const t of tarefas) {
    const id = t.momentoId ?? t.etapaId;
    const grupo = grupos.get(id) ?? { id, nome:t.nome, ordem:t.ordem, momentoId:t.momentoId, etapas:new Set<string>(), animais:new Map<string,boolean>(), componentes:[] };
    grupo.etapas.add(t.etapaId);
    grupo.animais.set(t.animalId, (grupo.animais.get(t.animalId) ?? true) && t.atendida);
    grupos.set(id, grupo);
    for (const fonte of t.fontes) { const ids=origens.get(fonte)??new Set<string>();ids.add(id);origens.set(fonte,ids); }
  }
  const integral = consolidarCustos(componentes, true);
  for (const c of integral.componentes) {
    const ids = origens.get(`${c.tipoFonte}:${c.fonteId}`);
    const id = ids?.size === 1 ? [...ids][0] : "SEM_ETAPA";
    if (!grupos.has(id)) grupos.set(id, {id,nome:"Custos sem etapa atribuída",ordem:Number.MAX_SAFE_INTEGER,momentoId:null,etapas:new Set(),animais:new Map(),componentes:[]});
    const grupo = grupos.get(id)!;
    if (id === "SEM_ETAPA") grupo.animais.set(c.animalId, false);
    grupo.componentes.push({...c,valor:c.valor==null?null:new Prisma.Decimal(c.valor)});
  }
  return [...grupos.values()].map(g=>{
    const resumo=consolidarCustos(g.componentes,verValores);
    return {id:g.id,nome:g.nome,ordem:g.ordem,momentoId:g.momentoId,etapaIds:[...g.etapas],participantes:g.animais.size,atendidos:[...g.animais.values()].filter(Boolean).length,
      procedimentos:new Set(g.componentes.map(c=>`${c.tipoFonte}:${c.fonteId}`)).size,totalConhecido:resumo.totalConhecido,situacao:resumo.situacao,cobertura:resumo.cobertura,componentesPendentes:resumo.componentesPendentes};
  }).sort((a,b)=>a.ordem-b.ordem||a.id.localeCompare(b.id));
}
