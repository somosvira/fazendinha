import { describe,it,expect } from "vitest";
import { hashConteudo,serializarEstavel } from "./publicacao.js";
import { exigirTipoRegistrado,validarResumoRegistrado } from "./registro.js";
describe("contrato de publicação",()=>{
 it("hash ignora ordem de propriedades e preserva conteúdo",()=>{expect(hashConteudo({b:2,a:{x:1,y:3}})).toBe(hashConteudo({a:{y:3,x:1},b:2}));expect(hashConteudo({a:1})).not.toBe(hashConteudo({a:2}));});
 it("serializa datas e não perde null/zero",()=>{expect(serializarEstavel({a:null,b:0,d:new Date("2026-10-28T00:00:00Z")})).toContain('"a":null');expect(serializarEstavel({a:null})).not.toBe(serializarEstavel({}));});
 it("recusa produtor e versão não registrados",()=>{expect(()=>exigirTipoRegistrado("arbitrario","IDADE",1)).toThrow();expect(()=>exigirTipoRegistrado("sanidade","IDADE",2)).toThrow();});
 it("recusa valores ou campos livres no resumo",()=>{expect(()=>validarResumoRegistrado("IDADE",{valor:123,titulo:"conteúdo"})).toThrow();});
});
