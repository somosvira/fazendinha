// @vitest-environment jsdom
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { cleanup,render,screen,fireEvent,waitFor } from "@testing-library/react";
import { CustosDiretos } from "./CustosDiretos";
import { obterCustos,escreverCustos,obterPreparatorios,type CustosDTO } from "./api";
vi.mock("./api",()=>({obterCustos:vi.fn(),escreverCustos:vi.fn(),obterPreparatorios:vi.fn()}));
vi.mock("../../../lib/auth",()=>({getUsuario:()=>JSON.parse(localStorage.getItem("usuario-custos")??"null")}));
const dados=():CustosDTO=>({rotulo:"Custo direto registrado",cobertura:"COMPLETO",situacao:"COMPLETO",totalConhecido:"100.00",componentesPendentes:0,componentes:[{chave:"movimento:m",fonteId:"t",tipoFonte:"TENTATIVA",animalId:"a",data:"2026-10-01",descricao:"Tentativa IA",estadoFato:"VALIDO",participacaoId:"p",finalidade:"REPRODUCAO",natureza:"MATERIAL",estado:"CONHECIDO",valor:"50.00",origemId:"m"}],limitacoes:["Logística não atribuída"],escopo:"TENTATIVA",propriedadeId:1,periodo:{inicio:null,fim:null,referencia:"DATA_DO_FATO"},totalIntegral:null,totalComponentes:1,pagina:1,limite:25,fontes:[{id:"t",tipo:"TENTATIVA",descricao:"Tentativa IA",data:"2026-10-01",origemMaterial:"DOCUMENTADA",versaoClassificacao:2,documentoMaterial:{referencia:"NF 10",evidencia:"Gratuidade comprovada"},classificacao:{finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",valorMaterialDocumentado:"0.00"}}],atribuicoesPreparos:[]});
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem("usuario-custos",JSON.stringify({dono:true,areas:[],flags:[]}));vi.mocked(obterCustos).mockResolvedValue(dados());vi.mocked(escreverCustos).mockResolvedValue({});vi.mocked(obterPreparatorios).mockResolvedValue({itens:[]});});
afterEach(()=>{cleanup();localStorage.clear();});
describe("composição de custos",()=>{
 it("mostra o custo direto e a limitação sem somar a visão inteira novamente",async()=>{render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);expect(screen.getByText(/Estas visões consultam os mesmos fatos/)).toBeTruthy();expect(screen.getByText("Logística não atribuída")).toBeTruthy();expect(obterCustos).toHaveBeenCalledWith({tentativaId:"t"},1,"","",1,"");});
 it("valor oculto conserva estado próprio e não oferece editor monetário",async()=>{localStorage.setItem("usuario-custos",JSON.stringify({dono:false,areas:["pecuaria"],flags:["lancar"]}));vi.mocked(obterCustos).mockResolvedValue({...dados(),situacao:"OCULTO",totalConhecido:null,componentes:dados().componentes.map(c=>({...c,valor:null,origemId:null}))});render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText("Valores ocultos",{selector:"strong"});expect(screen.queryByText(/100,00/)).toBeNull();expect(screen.queryByText("Classificar finalidade e composição")).toBeNull();});
 it("desconhecido não aparece como custo zero e permite filtrar por data do fato",async()=>{vi.mocked(obterCustos).mockResolvedValue({...dados(),cobertura:"DESCONHECIDO",situacao:"DESCONHECIDO",totalConhecido:null});render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar/>);await screen.findByText(/Valor ainda não comprovado/);fireEvent.change(screen.getByLabelText("Início do período"),{target:{value:"2026-09-01"}});await waitFor(()=>expect(obterCustos).toHaveBeenLastCalledWith({animalId:"a"},1,"2026-09-01","",1,""));expect(screen.queryByText(/^R\$\s*0,00$/)).toBeNull();});
 it("corrige finalidade com versão e preserva prova documental de zero",async()=>{render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);fireEvent.change(screen.getByLabelText("Fato a classificar"),{target:{value:"TENTATIVA:t"}});fireEvent.change(screen.getByLabelText("Finalidade gerencial"),{target:{value:"SANIDADE"}});fireEvent.change(screen.getByLabelText("Motivo da classificação"),{target:{value:"Finalidade conferida no atendimento"}});fireEvent.click(screen.getByRole("button",{name:"Salvar classificação"}));await waitFor(()=>expect(escreverCustos).toHaveBeenCalled());expect(vi.mocked(escreverCustos).mock.calls[0]).toEqual(["/classificacao",expect.objectContaining({fonteId:"t",tipo:"TENTATIVA",versao:2,finalidade:"SANIDADE",materialDocumentado:{valor:"0.00",referencia:"NF 10",evidencia:"Gratuidade comprovada"}}),1,"PUT"]);});
 it("preserva valores e chave depois da rejeição de uma parcela compartilhada",async()=>{vi.mocked(obterPreparatorios).mockResolvedValue({itens:[{id:"h",tipo:"APLICACAO",descricao:"Hormônio",data:"2026-09-30",rotulo:"Custo direto registrado",cobertura:"COMPLETO",situacao:"COMPLETO",totalConhecido:"30.00",componentesPendentes:0,componentes:[],limitacoes:[]}]});vi.mocked(escreverCustos).mockRejectedValueOnce(new Error("Origem já atribuída"));render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);const det=screen.getByText("Vincular preparatório à tentativa").parentElement!;det.setAttribute("open","");fireEvent(det,new Event("toggle"));await screen.findByRole("option",{name:/Hormônio/});fireEvent.change(screen.getByLabelText("Preparatório"),{target:{value:"APLICACAO:h"}});fireEvent.change(screen.getByLabelText("Atribuição"),{target:{value:"PARCELA"}});fireEvent.change(screen.getByLabelText("Parcela do material (R$)"),{target:{value:"10.25"}});fireEvent.change(screen.getByLabelText("Motivo do vínculo"),{target:{value:"Preparo compartilhado explicitamente"}});fireEvent.click(screen.getByRole("button",{name:"Confirmar vínculo"}));await screen.findByText("Origem já atribuída");const primeira=vi.mocked(escreverCustos).mock.calls[0][1];expect(screen.getByLabelText("Parcela do material (R$)")).toHaveProperty("value","10.25");fireEvent.click(screen.getByRole("button",{name:"Confirmar vínculo"}));await waitFor(()=>expect(escreverCustos).toHaveBeenCalledTimes(2));expect(vi.mocked(escreverCustos).mock.calls[1][1]).toEqual(primeira);});
});

it("ignora resposta antiga de outro alvo e sítio",async()=>{
 let resolver:(d:CustosDTO)=>void=()=>{};
 vi.mocked(obterCustos).mockImplementationOnce(()=>new Promise(resolve=>{resolver=resolve;})).mockResolvedValueOnce({...dados(),propriedadeId:2,totalConhecido:"200.00"});
 const {rerender}=render(<CustosDiretos tentativaId="a" propriedadeId={1} podeLancar/>);
 rerender(<CustosDiretos tentativaId="b" propriedadeId={2} podeLancar/>);
 await screen.findByText(/200,00/);resolver(dados());
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(screen.queryByText(/100,00/)).toBeNull();expect(screen.getByText(/200,00/)).toBeTruthy();
});
it("falha no segundo sítio não mantém custo do primeiro",async()=>{
 vi.mocked(obterCustos).mockResolvedValueOnce(dados()).mockRejectedValueOnce(new Error("Sítio sem leitura autorizada"));
 const {rerender}=render(<CustosDiretos tentativaId="a" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);
 rerender(<CustosDiretos tentativaId="b" propriedadeId={2} podeLancar/>);
 await screen.findByText("Sítio sem leitura autorizada");expect(screen.queryByText(/100,00/)).toBeNull();expect(screen.queryByText("Classificar finalidade e composição")).toBeNull();
});
it("não reaproveita preparatórios carregados para outra tentativa",async()=>{
 const candidato=(id:string)=>({id,tipo:"APLICACAO" as const,descricao:`Hormônio ${id}`,data:"2026-09-30",rotulo:"Custo direto registrado",cobertura:"COMPLETO",situacao:"COMPLETO",totalConhecido:"30.00",componentesPendentes:0,componentes:[],limitacoes:[]});
 vi.mocked(obterPreparatorios).mockImplementation(async id=>({itens:[candidato(id)]}));
 const {rerender}=render(<CustosDiretos tentativaId="a" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);
 fireEvent.click(screen.getByText("Vincular preparatório à tentativa"));await screen.findByRole("option",{name:/Hormônio a/});
 rerender(<CustosDiretos tentativaId="b" propriedadeId={2} podeLancar/>);await screen.findByText(/100,00/);
 fireEvent.click(screen.getByText("Vincular preparatório à tentativa"));await screen.findByRole("option",{name:/Hormônio b/});
 expect(screen.queryByRole("option",{name:/Hormônio a/})).toBeNull();
});
