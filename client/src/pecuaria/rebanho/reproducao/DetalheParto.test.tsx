// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DetalheParto, type PartoOperacional } from "./DetalheParto";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
vi.mock("./CorrigirFato",()=>({CorrigirFato:({id,propriedadeId,complementoInicial,onSalvo,onFechar}:{id:string;propriedadeId:number;complementoInicial?:string;onSalvo:()=>void;onFechar:()=>void})=><div role="dialog" aria-label="Correção do parto"><span>{id} · sítio {propriedadeId} · complemento {complementoInicial}</span><button onClick={onSalvo}>Concluir correção de teste</button><button onClick={onFechar}>Cancelar correção de teste</button></div>}));
vi.mock("./AnularFato",()=>({AnularFato:({id,propriedadeId,onFechar}:{id:string;propriedadeId:number;onFechar:()=>void})=><div role="dialog" aria-label="Anulação do parto"><span>{id} · sítio {propriedadeId}</span><button onClick={onFechar}>Cancelar anulação de teste</button></div>}));
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

it("reutiliza correção, anulação e colostro no detalhe com permissão de lançamento",async()=>{
 const comCriaViva={...parto,crias:[{...parto.crias[0],viva:true,animalId:"cria"}]};
 vi.mocked(reqV4).mockImplementation(async path=>path.startsWith("/reproducao/colostro?")?[]:comCriaViva);
 render(<DetalheParto id="p" propriedadeId={1} podeLancar/>);
 await screen.findByRole("heading",{name:"Parto de V4-011"});
 fireEvent.click(screen.getByRole("button",{name:"Corrigir / completar parto"}));
 expect(screen.getByRole("dialog",{name:"Correção do parto"}).textContent).toContain("p · sítio 1");
 fireEvent.click(screen.getByRole("button",{name:"Concluir correção de teste"}));
 await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Correção do parto"})).toBeNull());
 await screen.findByRole("heading",{name:"Parto de V4-011"});
 expect(vi.mocked(reqV4).mock.calls.filter(c=>c[0]==="/reproducao/partos/p")).toHaveLength(2);
 fireEvent.click(screen.getByRole("button",{name:"Conferir anulação"}));
 expect(screen.getByRole("dialog",{name:"Anulação do parto"}).textContent).toContain("p · sítio 1");
 fireEvent.click(screen.getByRole("button",{name:"Cancelar anulação de teste"}));
 fireEvent.click(screen.getAllByRole("button",{name:"Gerenciar colostro da cria 1"})[0]);
 await screen.findByRole("button",{name:"Adicionar fornecimento"});
 expect(reqV4).toHaveBeenCalledWith("/reproducao/colostro?criaId=c&propriedadeId=1",undefined,"GET",1);
});
it.each([false,true])("oculta escritas para leitor ou parto anulado (anulado=%s)",async anulado=>{
 vi.mocked(reqV4).mockResolvedValue({...parto,status:anulado?"ANULADO":"VALIDO",crias:[{...parto.crias[0],viva:true}]});
 render(<DetalheParto id="p" propriedadeId={1} podeLancar={anulado}/>);
 await screen.findByRole("heading",{name:"Parto de V4-011"});
 expect(screen.queryByRole("button",{name:"Corrigir / completar parto"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Conferir anulação"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Registrar retirada de colostro"})).toBeNull();
 expect(screen.queryByRole("button",{name:/Gerenciar colostro/})).toBeNull();
});

it("avaliação de escore conserva parto e sítio mesmo sem avaliações anteriores",async()=>{
 vi.mocked(reqV4).mockResolvedValue({...parto,acompanhamentos:[]});
 render(<DetalheParto id="p" propriedadeId={1} podeLancar/>);
 fireEvent.click(await screen.findByRole("button",{name:"Registrar avaliação de escore"}));
 expect(screen.getByRole("dialog",{name:"Correção do parto"}).textContent).toContain("p · sítio 1 · complemento escore");
 expect(vi.mocked(reqV4).mock.calls.every(c=>c[2]==="GET")).toBe(true);
});

it("inicia retirada no bezerreiro conservando o parto e sem gravar produção",async()=>{
 vi.mocked(reqV4).mockResolvedValue(parto);render(<DetalheParto id="p" propriedadeId={1} podeLancar/>);
 fireEvent.click(await screen.findByRole("button",{name:"Registrar retirada de colostro"}));
 expect(location.pathname).toBe("/pecuaria/bezerreiro");
 const params=new URLSearchParams(location.search);expect(params.get("aba")).toBe("colostragem");expect(params.get("partoId")).toBe("p");expect(params.get("novaRetirada")).toBe("1");
 expect(vi.mocked(reqV4).mock.calls.every(c=>c[2]==="GET")).toBe(true);
});
