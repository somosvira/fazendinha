// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DetalheParto, type PartoOperacional } from "./DetalheParto";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
const parto:PartoOperacional={id:"p",versao:1,propriedadeId:1,status:"VALIDO",matriz:{id:"a",brinco:"V4-011",nome:null},data:"2026-10-07",ocorridoEm:null,horarioEstimado:false,desfecho:"NASCIMENTO",tipo:"DISTOCICO",induzido:null,dificuldade:true,assistenciaDescricao:null,retencaoPlacenta:true,responsavel:null,observacao:null,lancador:null,criadoEm:"2026-10-07",ocorrenciasRetencaoPlacenta:[],pesosMatriz:[],escoresMatriz:[{id:"e",data:"2026-10-07",responsavel:null,resultados:[{campo:"ESCORE",valor:0},{campo:"ESCALA_MAX",valor:5}]}],crias:[{id:"c",animalId:null,ordem:1,sexo:"F",viva:false,filiacaoSnapshot:{},pesos:[],colostro:[]}]};
afterEach(cleanup);beforeEach(()=>vi.clearAllMocks());
it("consulta somente o parto solicitado e apresenta dados clínicos sem chaves técnicas",async()=>{
 vi.mocked(reqV4).mockResolvedValue(parto);render(<DetalheParto id="p" propriedadeId={1}/>);
 await screen.findByRole("heading",{name:"Parto de V4-011"});
 expect(reqV4).toHaveBeenCalledWith("/reproducao/partos/p",undefined,"GET",1);
 expect(screen.getByText("Distócico")).toBeTruthy();expect(screen.queryByText("ESCALA_MAX")).toBeNull();
 expect(screen.getAllByText("Máximo da escala").length).toBeGreaterThan(0);
 expect(screen.getAllByText("0").length).toBeGreaterThan(0);
 expect(vi.mocked(reqV4).mock.calls.every(c=>c[2]==="GET")).toBe(true);
});
it("resposta antiga não substitui o contexto do sítio atual",async()=>{
 let resolver:(v:PartoOperacional)=>void=()=>{};
 vi.mocked(reqV4).mockReturnValueOnce(new Promise(resolve=>{resolver=resolve;})).mockResolvedValueOnce({...parto,propriedadeId:2,matriz:{...parto.matriz,brinco:"Destino"}});
 const {rerender}=render(<DetalheParto id="p" propriedadeId={1}/>);rerender(<DetalheParto id="p" propriedadeId={2}/>);
 await screen.findByRole("heading",{name:"Parto de Destino"});resolver(parto);
 await waitFor(()=>expect(screen.queryByRole("heading",{name:"Parto de V4-011"})).toBeNull());
});
it("falha de leitura não vira ausência de crias",async()=>{
 vi.mocked(reqV4).mockRejectedValue(new Error("Parto não encontrado neste sítio"));render(<DetalheParto id="p" propriedadeId={2}/>);
 await screen.findByText("Parto não encontrado neste sítio");expect(screen.getByRole("button",{name:"Tentar novamente"})).toBeTruthy();expect(screen.queryByText("Nenhum registro informado.")).toBeNull();
});
