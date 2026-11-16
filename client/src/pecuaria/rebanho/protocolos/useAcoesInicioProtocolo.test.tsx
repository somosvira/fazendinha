// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAcoesInicioProtocolo } from "./useAcoesInicioProtocolo";
import { obterAcoesCadastro, obterCadastroProtocolo, type CadastroProtocoloMeta } from "./cadastros-api";
vi.mock("./cadastros-api",()=>({obterAcoesCadastro:vi.fn(),obterCadastroProtocolo:vi.fn()}));
const modelo={id:"p1",publicado:true,ativo:true,atualizadoEm:"r1"} as CadastroProtocoloMeta;
beforeEach(()=>{vi.resetAllMocks();vi.mocked(obterCadastroProtocolo).mockResolvedValue(modelo);});
it("carrega todas as páginas da revisão antes de liberar preparo",async()=>{
 vi.mocked(obterAcoesCadastro).mockImplementation(async(_,pagina)=>({itens:Array.from({length:pagina===1?10:1},(_,i)=>({id:`${pagina}-${i}`})),total:11,pagina,porPagina:10}));
 const {result}=renderHook(()=>useAcoesInicioProtocolo("p1",7));
 expect(result.current.etapas).toBeNull();
 await waitFor(()=>expect(result.current.etapas).toHaveLength(11));
 expect(obterAcoesCadastro).toHaveBeenNthCalledWith(2,modelo,2);
});
it("não libera um conjunto parcial quando a segunda página falha",async()=>{
 vi.mocked(obterAcoesCadastro).mockResolvedValueOnce({itens:Array.from({length:10},(_,i)=>({id:String(i)})),total:11,pagina:1,porPagina:10}).mockRejectedValueOnce(new Error("A versão mudou"));
 const {result}=renderHook(()=>useAcoesInicioProtocolo("p1",7));
 await waitFor(()=>expect(result.current.erro).toBe("A versão mudou"));
 expect(result.current.etapas).toBeNull();
});
it("descarta resposta da versão anterior depois de trocar o protocolo",async()=>{
 let terminar:(v:CadastroProtocoloMeta)=>void=()=>{};
 vi.mocked(obterCadastroProtocolo).mockImplementationOnce(()=>new Promise(resolve=>{terminar=resolve;})).mockResolvedValueOnce({...modelo,id:"p2"});
 vi.mocked(obterAcoesCadastro).mockResolvedValue({itens:[],total:0,pagina:1,porPagina:10});
 const {result,rerender}=renderHook(({id})=>useAcoesInicioProtocolo(id,7),{initialProps:{id:"p1"}});
 rerender({id:"p2"});await waitFor(()=>expect(result.current.etapas).toEqual([]));
 await act(async()=>{terminar(modelo);});
 expect(result.current.etapas).toEqual([]);expect(result.current.erro).toBeNull();
});
