import { describe, expect, it, vi } from "vitest";
import { carregarPreviaCompleta, resumoRevisao, type AnimalPlanner, type GrupoPlanner, type GrupoRevisado, type PreviaPlanner } from "./planner-api";
import { criteriosVazios, validarCriterios } from "./EditorSelecaoVisita";
const grupo: GrupoPlanner = {grupo:{origem:"RETORNO",identidade:"grupo"},nome:"Retornos",secao:"REPRODUCAO",janela:"DIA",tipo:"AVALIACAO_REPRODUTIVA",protocolo:null,turma:null,etapa:null,previstaPara:"2026-10-14",precisaoTemporal:"DIA",criterios:null,totalAnimais:601,totalProcedimentos:601,emVisitaAberta:0};
const animal = (n:number):AnimalPlanner => ({animalId:String(n),tarefaId:null,motivos:[],visitasAbertas:[]});
const previa = (animais:AnimalPlanner[], total=animais.length):PreviaPlanner => ({grupo,animais,total,pagina:1,tamanhoPagina:200,fingerprint:"original"});
describe("revisão dos grupos de visita",()=>{
 it("carrega o grupo acima de 500 sem confundir página com limite",async()=>{
  const carregar=vi.fn(async (_p:number,_d:string,_g:unknown,pagina=1)=>({...previa(Array.from({length:pagina===4?1:200},(_,i)=>animal((pagina-1)*200+i)),601),pagina}));
  const resultado=await carregarPreviaCompleta(1,"2026-10-14",grupo.grupo,carregar);
  expect(resultado.animais).toHaveLength(601);expect(carregar).toHaveBeenCalledTimes(4);expect(resultado.animais[600].animalId).toBe("600");
 });
 it("invalida páginas quando a identidade da prévia muda",async()=>{
  const carregar=vi.fn(async (_p:number,_d:string,_g:unknown,pagina=1)=>({...previa([animal(pagina)],2),fingerprint:pagina===1?"original":"alterada"}));
  await expect(carregarPreviaCompleta(1,"2026-10-14",grupo.grupo,carregar)).rejects.toThrow("grupo mudou");
 });
 it("conta animais únicos e procedimentos entre grupos e aplica exclusão por animal",()=>{
  const revisoes:GrupoRevisado[]=[{previa:previa([animal(1),animal(2),{...animal(2),tarefaId:"outra"}]),excluidos:["1"],chave:"a"},{previa:previa([animal(2),animal(3)]),excluidos:[],chave:"b"}];
  expect(resumoRevisao(revisoes)).toEqual({animais:2,procedimentos:4});
 });
 it("não carrega indefinidamente uma página vazia de um grupo modificado",async()=>{
  const carregar=vi.fn(async (_p:number,_d:string,_g:unknown,pagina=1)=>previa(pagina===1?[animal(1)]:[],2));
  await expect(carregarPreviaCompleta(1,"2026-10-14",grupo.grupo,carregar)).rejects.toThrow("grupo mudou");expect(carregar).toHaveBeenCalledTimes(2);
 });
});
describe("critérios da seleção habitual",()=>{
 it("não inventa limites clínicos ao iniciar uma seleção",()=>{expect(criteriosVazios()).toMatchObject({todas:[],qualquer:[]});});
 it("recusa faixa vazia e limites inválidos sem perder zero",()=>{
  const c=criteriosVazios();c.todas=[{tipo:"FAIXA",campo:"DEL",min:0,max:0,incluirMin:true,incluirMax:true}];expect(validarCriterios(c)).toBeNull();
  c.todas=[{tipo:"FAIXA",campo:"DEL",min:0,max:0,incluirMin:false,incluirMax:true}];expect(validarCriterios(c)).toMatch("ao menos um valor");
  c.todas=[{tipo:"FAIXA",campo:"DEL",incluirMin:true,incluirMax:true}];expect(validarCriterios(c)).toMatch("ao menos um limite");
 });
 it("recusa alternativas sem condição",()=>{const c=criteriosVazios();c.qualquer=[{id:"a",todas:[]}];expect(validarCriterios(c)).toMatch("bloco alternativo");});
});
