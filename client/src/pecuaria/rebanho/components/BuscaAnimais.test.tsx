// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AnimalResumo, ListarResultado } from "../types";
import { BuscaAnimais } from "./BuscaAnimais";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
const { listar, catalogos, categorias } = vi.hoisted(() => ({ listar: vi.fn(), catalogos: vi.fn(), categorias: vi.fn() }));
vi.mock("../api", () => ({ listarAnimais: listar, obterCatalogos: catalogos, listarCategorias: categorias }));
vi.mock("@/financeiro/SelectCampo", () => ({ SelectCampo: ({children,onValueChange,...props}: {children:React.ReactNode;onValueChange:(v:string)=>void;value:string}) => <select {...props} onChange={e=>onValueChange(e.target.value)}>{children}</select> }));
const animal = { id:"a1", brinco:"DEV-019", nome:"Estrela", sexo:"F", situacao:"ATIVO", categoria:{id:"c1",nome:"Vaca"}, propriedade:{id:7,nome:"Sede"}, lote:null } as AnimalResumo;
const resultado = (itens=[animal],total=itens.length) => ({itens,total,painel:{}} as ListarResultado);
const props = () => ({aberto:true,onFechar:vi.fn(),onAbrir:vi.fn(),podeConsultar:true,escopo:"Consolidado"});
beforeEach(()=>{vi.clearAllMocks();listar.mockResolvedValue(resultado());catalogos.mockResolvedValue({propriedades:[{id:7,nome:"Sede"}],lotes:[],racas:[],motivosBaixa:[]});categorias.mockResolvedValue({itens:[]});setPropriedadeAtiva(null); window.HTMLElement.prototype.scrollIntoView=vi.fn();});
afterEach(()=>{cleanup();vi.useRealTimers();setPropriedadeAtiva(null);});
it("lista sem termo, com contexto e todos os animais, e Enter abre a ficha no sítio exato",async()=>{
 const p=props();render(<BuscaAnimais {...p}/>); await screen.findByRole("button",{name:/DEV-019/});
 expect(listar).toHaveBeenCalledWith(expect.objectContaining({situacao:"TODOS",page:1,pageSize:20,comContexto:true}),undefined,expect.any(AbortSignal));
 const input=screen.getByRole("searchbox",{name:"Buscar animal"});expect(document.activeElement).toBe(input);
 fireEvent.keyDown(input,{key:"Enter"}); expect(p.onAbrir).toHaveBeenCalledWith("a1",expect.stringContaining("/animais/a1?"));
 expect(p.onAbrir.mock.calls[0][1]).toContain("propriedadeId=7");expect(p.onAbrir.mock.calls[0][1]).toContain("sitio=7");
 expect(screen.getAllByText("Não informada").length).toBe(2);
});
it("pagina no servidor e volta à primeira página ao filtrar",async()=>{
 listar.mockResolvedValue(resultado([animal],41));render(<BuscaAnimais {...props()}/>);await screen.findByRole("button",{name:/DEV-019/});
 fireEvent.click(screen.getByRole("button",{name:/Próxima/i}));await waitFor(()=>expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({page:2}),undefined,expect.any(AbortSignal)));
 fireEvent.change(screen.getByRole("combobox",{name:"Situação"}),{target:{value:"BAIXADO"}});
 await waitFor(()=>expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({page:1,situacao:"BAIXADO"}),undefined,expect.any(AbortSignal)));
});
it("busca após debounce e impede abrir a lista antiga durante a digitação",async()=>{
 const p=props();render(<BuscaAnimais {...p}/>);await screen.findByRole("button",{name:/DEV-019/});vi.useFakeTimers();
 const input=screen.getByRole("searchbox",{name:"Buscar animal"});fireEvent.change(input,{target:{value:"Lua"}});fireEvent.keyDown(input,{key:"Enter"});expect(p.onAbrir).not.toHaveBeenCalled();
 expect(screen.queryByRole("button",{name:/DEV-019/})).toBeNull();await act(async()=>{await vi.advanceTimersByTimeAsync(250)});
 expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({busca:"Lua",page:1}),undefined,expect.any(AbortSignal));
});
it("distingue falha de ausência e permite tentar novamente",async()=>{
 listar.mockRejectedValueOnce(new Error("rede"));render(<BuscaAnimais {...props()}/>);await screen.findByRole("alert");expect(screen.queryByText("Nenhum animal encontrado")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));await screen.findByRole("button",{name:/DEV-019/});
});
it("não consulta sem permissão",async()=>{
 render(<BuscaAnimais {...props()} podeConsultar={false}/>);expect(screen.getByText("Acesso restrito ao Rebanho")).toBeTruthy();expect(listar).not.toHaveBeenCalled();expect(catalogos).not.toHaveBeenCalled();
});
it("descarta a resposta anterior ao trocar filtro",async()=>{
 let resolver:(r:ListarResultado)=>void=()=>{};listar.mockImplementationOnce(()=>new Promise<ListarResultado>(r=>{resolver=r}));
 render(<BuscaAnimais {...props()}/>);await waitFor(()=>expect(listar).toHaveBeenCalledTimes(1));
 fireEvent.change(screen.getByRole("combobox",{name:"Sexo"}),{target:{value:"M"}});await screen.findByRole("button",{name:/DEV-019/});
 await act(async()=>resolver(resultado([{...animal,id:"antigo",brinco:"RESPOSTA-ANTIGA"}])));expect(screen.queryByText("RESPOSTA-ANTIGA")).toBeNull();
});
it("mantém o sítio selecionado no shell e não oferece outros sítios",async()=>{
 setPropriedadeAtiva(7);catalogos.mockResolvedValue({propriedades:[{id:7,nome:"Sede"},{id:8,nome:"Outra"}],lotes:[],racas:[],motivosBaixa:[]});
 render(<BuscaAnimais {...props()}/>);await screen.findByRole("button",{name:/DEV-019/});fireEvent.click(screen.getByRole("button",{name:"Mais filtros"}));
 expect(screen.getByRole("combobox",{name:"Sítio"}).hasAttribute("disabled")).toBe(true);expect(screen.queryByRole("option",{name:"Outra"})).toBeNull();
});
it("seta a partir do botão move também o foco para a ficha destacada",async()=>{
 listar.mockResolvedValue(resultado([animal,{...animal,id:"a2",brinco:"DEV-020",nome:"Lua"}]));const p=props();render(<BuscaAnimais {...p}/>);
 const primeiro=await screen.findByRole("button",{name:/DEV-019/});const segundo=screen.getByRole("button",{name:/DEV-020/});
 act(()=>primeiro.focus());fireEvent.keyDown(primeiro,{key:"ArrowDown"});expect(document.activeElement).toBe(segundo);
 fireEvent.click(document.activeElement!);expect(p.onAbrir).toHaveBeenCalledWith("a2",expect.any(String));
});
it("anuncia o animal selecionado quando as setas são usadas no campo",async()=>{
 listar.mockResolvedValue(resultado([animal,{...animal,id:"a2",brinco:"DEV-020",nome:"Lua"}]));render(<BuscaAnimais {...props()}/>);await screen.findByRole("button",{name:/DEV-019/});
 fireEvent.keyDown(screen.getByRole("searchbox",{name:"Buscar animal"}),{key:"ArrowDown"});expect(screen.getByRole("status").textContent).toContain("DEV-020");
});
it("mostra ausência com total zero, sem confundir com carregamento",async()=>{
 listar.mockResolvedValue(resultado([]));render(<BuscaAnimais {...props()}/>);expect(await screen.findByText("Nenhum animal encontrado")).toBeTruthy();expect(screen.getByText("0 animais")).toBeTruthy();
});
it("reabrir limpa os filtros da abertura anterior",async()=>{
 const p=props();const {rerender}=render(<BuscaAnimais {...p}/>);await screen.findByRole("button",{name:/DEV-019/});
 fireEvent.change(screen.getByRole("combobox",{name:"Situação"}),{target:{value:"BAIXADO"}});
 rerender(<BuscaAnimais {...p} aberto={false}/>);rerender(<BuscaAnimais {...p}/>);
 expect(screen.getByRole("combobox",{name:"Situação"})).toHaveProperty("value","TODOS");
});
it("o filtro de sítio em consolidado restringe a consulta e limpa o lote",async()=>{
 catalogos.mockResolvedValue({propriedades:[{id:7,nome:"Sede"},{id:8,nome:"Outra"}],lotes:[{id:"l1",nome:"Lote da Sede",propriedadeId:7}],racas:[],motivosBaixa:[]});
 render(<BuscaAnimais {...props()}/>);await screen.findByRole("option",{name:"Lote da Sede"});
 fireEvent.change(screen.getByRole("combobox",{name:"Lote"}),{target:{value:"l1"}});fireEvent.click(screen.getByRole("button",{name:"Mais filtros"}));
 fireEvent.change(screen.getByRole("combobox",{name:"Sítio"}),{target:{value:"8"}});
 await waitFor(()=>expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({propriedadeId:8,loteId:undefined,page:1}),undefined,expect.any(AbortSignal)));
 expect(screen.getByRole("combobox",{name:"Lote"})).toHaveProperty("value","");
});
