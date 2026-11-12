import { describe, expect, it } from "vitest";
import { agruparAgendaEtapas, type LinhaAgendaEtapa } from "./agenda-etapas.calc.js";
const linha=(id:string,animalId:string,situacao="ATENDIDO"):LinhaAgendaEtapa=>({id,animalId,situacao,etapaId:id,momentoId:"m1",nome:"D0",ordem:1,previstaPara:new Date("2026-11-03T01:00:00Z"),precisaoTemporal:"HORA",fusoHorario:"America/Sao_Paulo"});
describe("agenda por etapa",()=>{
 it("agrupa dia no fuso, conta animais distintos e exige todas as ações atendidas",()=>{
   const [g]=agruparAgendaEtapas([linha("e1","a"),linha("e2","a","NAO_ATENDIDO"),linha("e3","b")]);
   expect(g).toMatchObject({dia:"2026-11-02",participantes:2,atendidos:1,pendentes:1,procedimentos:3});
 });
 it("mantém precisão de dia e datas individuais em grupos separados",()=>{
   const grupos=agruparAgendaEtapas([linha("e1","a"),{...linha("e2","b"),precisaoTemporal:"DIA"}]);
   expect(grupos.map(g=>g.dia)).toEqual(["2026-11-02","2026-11-03"]);
 });
 it("não mistura etapas legadas sem momento explícito",()=>{
   expect(agruparAgendaEtapas([{...linha("e1","a"),momentoId:null},{...linha("e2","a"),momentoId:null}])).toHaveLength(2);
 });
});
