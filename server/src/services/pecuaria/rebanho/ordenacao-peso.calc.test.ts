import { describe, expect, it } from "vitest";
import { ordenarPorPeso } from "./ordenacao-peso.calc.js";
const animal=(id:string,pesos:number[])=>({id,brinco:id,pesagens:pesos.map((pesoKg,i)=>({pesoKg,data:new Date(`2026-10-${i===0?'20':'10'}T00:00:00Z`)}))});
describe("ordenação global por desempenho",()=>{
 it("ordena todos os animais antes do recorte da página e deixa peso ausente por último",()=>{
 const animais=[animal("a",[400,399]),animal("b",[]),animal("c",[200,190])];
 expect(ordenarPorPeso(animais,"ultimoPeso","asc").slice(0,1)[0].id).toBe("c");
 expect(ordenarPorPeso(animais,"ultimoPeso","desc").map(a=>a.id)).toEqual(["a","c","b"]);
 expect(animais[0].id).toBe("a");
 });
 it("usa GMD entre as duas últimas pesagens e não trata ausência como zero",()=>{
 const animais=[animal("a",[400,400]),animal("b",[200]),animal("c",[200,190])];
 expect(ordenarPorPeso(animais,"gmd","asc").map(a=>a.id)).toEqual(["a","c","b"]);
 expect(ordenarPorPeso(animais,"gmd","desc").map(a=>a.id)).toEqual(["c","a","b"]);
 });
});
