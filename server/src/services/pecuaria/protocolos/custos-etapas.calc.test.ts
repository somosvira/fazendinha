import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { agruparCustosEtapas, type TarefaCustoEtapa } from "./custos-etapas.calc.js";
import type { ComponenteCusto } from "../custos/custos.calc.js";
const tarefa=(animalId:string,etapaId="e1",atendida=true):TarefaCustoEtapa=>({animalId,etapaId,momentoId:"m1",nome:"D0",ordem:1,atendida,fontes:[`APLICACAO:${animalId}`]});
const custo=(animalId:string,valor:string|null="10.25"):ComponenteCusto=>({chave:`c:${animalId}`,fonteId:animalId,tipoFonte:"APLICACAO",animalId,data:"2026-11-03",descricao:"Aplicação",estadoFato:"VALIDO",participacaoId:"p1",finalidade:"REPRODUCAO",natureza:"MATERIAL",estado:valor==null?"DESCONHECIDO":"CONHECIDO",valor:valor==null?null:new Prisma.Decimal(valor),origemId:"estoque-1"});
describe("custos por etapa",()=>{
  it("agrega todos os animais e deduplica componentes antes de paginar",()=>{
    const tarefas=Array.from({length:23},(_,i)=>tarefa(`a${i}`));const custos=tarefas.map(t=>custo(t.animalId));
    const [g]=agruparCustosEtapas(tarefas,[...custos,custos[0]],true);
    expect(g).toMatchObject({participantes:23,atendidos:23,procedimentos:23,totalConhecido:"235.75",cobertura:"COMPLETO"});
  });
  it("atendimento parcial de procedimentos não conta o animal como atendido",()=>{
    const [g]=agruparCustosEtapas([tarefa("a"),tarefa("a","e2",false)],[custo("a"),custo("b",null)],true);
    expect(g).toMatchObject({participantes:1,atendidos:0,totalConhecido:"10.25"});
  });
  it("preserva custo desconhecido, zero e custos sem etapa, sem duplicar origem ambígua",()=>{
    const outra={...tarefa("a","e2"),momentoId:"m2"};
    const grupos=agruparCustosEtapas([tarefa("a"),outra,tarefa("b")],[custo("a"),custo("b","0"),custo("c",null)],true);
    expect(grupos.find(g=>g.id==="SEM_ETAPA")).toMatchObject({totalConhecido:"10.25",cobertura:"PARCIAL",componentesPendentes:1});
    expect(grupos.find(g=>g.id==="m1")).toMatchObject({totalConhecido:"0.00",cobertura:"COMPLETO"});
    expect(grupos.find(g=>g.id==="m2")).toMatchObject({totalConhecido:null,cobertura:"DESCONHECIDO"});
  });
  it("oculta valores no DTO sem perder quantidades nem cobertura",()=>{
    const [g]=agruparCustosEtapas([tarefa("a")],[custo("a")],false);
    expect(g).toMatchObject({participantes:1,atendidos:1,totalConhecido:null,situacao:"OCULTO",cobertura:"COMPLETO"});
    expect(JSON.stringify(g)).not.toContain("10.25");expect(JSON.stringify(g)).not.toContain("estoque-1");
  });
});
