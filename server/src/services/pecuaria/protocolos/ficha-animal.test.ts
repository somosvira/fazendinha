import { describe, expect, it } from "vitest";
import { consultaProtocolosAnimalSchema, faseProtocoloAnimal, filtroPeriodoProtocolosAnimal } from "./ficha-animal.js";
const etapa=(id:string,ordem:number,situacao:string)=>({id,nome:id,ordem,situacao,realizadaEm:null});
describe("protocolos na ficha",()=>{
 it("identifica a primeira etapa realmente pendente sem confundir quantidade atendida e ordem",()=>{
   expect(faseProtocoloAnimal([etapa("primeira",1,"ADIADO"),etapa("segunda",2,"ATENDIDO")],false)).toMatchObject({atendidas:1,atual:{nome:"primeira",numero:1},situacao:"EM_ANDAMENTO"});
 });
 it("não afirma conclusão para dispensas, participação cancelada ou ausência de etapas",()=>{
   expect(faseProtocoloAnimal([etapa("a",1,"DISPENSADO")],false).situacao).toBe("ETAPAS_ENCERRADAS");
   expect(faseProtocoloAnimal([etapa("a",1,"ATENDIDO")],false).situacao).toBe("CONCLUIDO");
   expect(faseProtocoloAnimal([etapa("a",1,"SEM_REGISTRO")],true)).toMatchObject({situacao:"ENCERRADO",atual:null});
   expect(faseProtocoloAnimal([],false).situacao).toBe("SEM_ETAPAS");
 });
 it("valida datas e limita cada resposta a dez participações",()=>{
   const animalId="11111111-1111-4111-8111-111111111111";
   expect(consultaProtocolosAnimalSchema.safeParse({animalId,porPagina:11}).success).toBe(false);
   expect(consultaProtocolosAnimalSchema.safeParse({animalId,inicio:"2026-10-31",fim:"2026-10-01"}).success).toBe(false);
 });
 it("não infere conclusão ou fase global com tarefas de um único sítio histórico",()=>{
   expect(faseProtocoloAnimal([etapa("a",1,"ATENDIDO")],false,false)).toMatchObject({situacao:"ESCOPO_PARCIAL",escopoCompleto:false});
 });
 it("mantém acompanhamento clínico pendente na fase, mesmo com tarefa atendida",()=>{
   expect(faseProtocoloAnimal([{...etapa("a",1,"ATENDIDO"),acompanhamentoPendente:true}],false)).toMatchObject({situacao:"EM_ANDAMENTO",atual:{nome:"a",situacao:"ACOMPANHAMENTO_PENDENTE"}});
 });
 it("filtra pelo início efetivo quando conhecido e respeita dia civil em cada precisão",()=>{
   const filtro=filtroPeriodoProtocolosAnimal("2026-10-01","2026-10-31");
   expect(filtro.OR).toEqual(expect.arrayContaining([
     expect.objectContaining({precisaoInicioEfetivo:"DIA",inicioEfetivo:{gte:new Date("2026-10-01T00:00:00Z"),lt:new Date("2026-11-01T00:00:00Z")}}),
     expect.objectContaining({inicioEfetivo:null,precisaoTemporal:"HORA",inicio:{gte:new Date("2026-10-01T03:00:00Z"),lt:new Date("2026-11-01T03:00:00Z")}}),
   ]));
 });
});
