import { describe, expect, it } from "vitest";
import { intervalosPresenca, type AnimalPopulacao, type Permanencia } from "./presenca.calc.js";
const d=(s:string)=>new Date(s);
const animal:AnimalPopulacao={id:"a",sexo:"F",dataEntrada:d("2026-01-01"),partosAntesDaEntrada:0,categoriasManuais:[],partos:[{data:d("2026-10-02"),status:"VALIDO"}]};
const local:Permanencia={id:"l",animalId:"a",propriedadeId:1,loteId:"x",desde:d("2026-01-01"),ate:null};
describe("população de vacas por paridade na data",()=>{
  it("fêmea passa de novilha a vaca no dia do parto, independentemente da lactação",()=>{
    expect(intervalosPresenca(animal,[local],d("2026-10-01"),d("2026-10-03")).map(s=>[s.desde.toISOString().slice(0,10),s.vaca])).toEqual([["2026-10-01",false],["2026-10-02",true]]);
  });
  it("saldo anterior inclui vaca seca; macho não integra essa população",()=>{
    expect(intervalosPresenca({...animal,partos:[],partosAntesDaEntrada:2},[local],d("2026-10-01"),d("2026-10-01"))[0].vaca).toBe(true);
    expect(intervalosPresenca({...animal,sexo:"M",partosAntesDaEntrada:2},[local],d("2026-10-01"),d("2026-10-01"))[0].vaca).toBe(false);
  });
  it("exceção manual, data anterior à entrada e história conflitante não inventam classificação",()=>{
    const excecao={id:"ex",desde:d("2026-01-01"),ate:null};
    expect(intervalosPresenca({...animal,categoriasManuais:[excecao]},[local],d("2026-10-01"),d("2026-10-01"))[0].vaca).toBeNull();
    expect(intervalosPresenca(animal,[local,{...local,id:"duplicado"}],d("2026-10-01"),d("2026-10-01"))).toEqual([]);
  });
});
