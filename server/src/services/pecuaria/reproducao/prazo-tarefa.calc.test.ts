import { describe, expect, it } from "vitest";
import { tarefaComPrazoHerdado } from "./prazo-tarefa.calc.js";
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const base=()=>({previstaPara:dia("2026-01-20"),previsaoOriginal:dia("2026-01-20"),precisaoTemporal:"DIA",previsaoPendente:false,realizadaEm:null,dispensadaEm:null,regularizacaoPendente:false,parametros:{previsaoOriginal:"2026-01-20"},historicoReprogramacao:[],eventos:[],_count:{aplicacoes:0,exames:0,tentativas:0,manejos:0,vinculos:0}});
describe("identificação comprovada de prazo herdado",()=>{
 it("aceita calendário original e revisões anteriores rastreáveis",()=>{
  expect(tarefaComPrazoHerdado(base(),dia("2026-01-20"))).toBe(true);
  expect(tarefaComPrazoHerdado({...base(),previstaPara:dia("2026-01-25"),historicoReprogramacao:[{acao:"REVISAO_REGRA_ACOMPANHAMENTO",previstaNova:"2026-01-25"}]},dia("2026-01-25"))).toBe(true);
 });
 it("preserva decisões individuais, atendimento, calendário ambíguo e horários",()=>{
  for(const alteracao of [{eventos:[{id:"adiamento"}]},{historicoReprogramacao:[{acao:"REAGENDAMENTO"}]},{parametros:null},{precisaoTemporal:"HORA"},{realizadaEm:dia("2026-01-20")},{previstaPara:dia("2026-01-21")},{_count:{aplicacoes:0,exames:1,tentativas:0,manejos:0,vinculos:0}}]) expect(tarefaComPrazoHerdado({...base(),...alteracao},dia("2026-01-20"))).toBe(false);
 });
});
