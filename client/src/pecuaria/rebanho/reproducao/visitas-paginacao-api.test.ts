import {afterEach,expect,it,vi} from "vitest";
import {listarParticipantesVisita,obterVisita} from "./visitas-api";
afterEach(()=>vi.unstubAllGlobals());
it("solicita somente resumo sem árvore e normaliza participantes ausentes",async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"v",atividades:[{id:"a",totais:{totalParticipantes:1000,confirmados:1}}],impressoes:[],totalAnimais:1000,totalParticipantes:1000}),{status:200}));vi.stubGlobal("fetch",fetch);
 const v=await obterVisita("v");expect(fetch.mock.calls[0][0]).toContain("/visitas/v?resumo=true");expect(v.atividades[0].participantes).toEqual([]);expect(v.totalParticipantes).toBe(1000);
});
it("envia busca e filtros ao servidor sem pedir mais de dez participantes",async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({itens:[],total:50,pagina:3,porPagina:10}),{status:200}));vi.stubGlobal("fetch",fetch);
 await listarParticipantesVisita("v","a",7,{pagina:3,busca:"023",status:"PENDENTE",motivos:["Diagnóstico","Retorno"]});
 const q=new URL(fetch.mock.calls[0][0],"https://local").searchParams;expect(q.get("porPagina")).toBe("10");expect(q.get("pagina")).toBe("3");expect(q.get("busca")).toBe("023");expect(q.getAll("motivo")).toEqual(["Diagnóstico","Retorno"]);expect(new Headers(fetch.mock.calls[0][1].headers).get("X-Propriedade-Id")).toBe("7");
});
