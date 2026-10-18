// @vitest-environment jsdom
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { cleanup,render,screen,fireEvent,waitFor } from "@testing-library/react";
import { CustosDiretos } from "./CustosDiretos";
import { obterCustos,escreverCustos,obterPreparatorios,type CustosDTO } from "./api";
vi.mock("../../../lib/hoje",()=>({getHoje:()=>new Date(2026,9,18)}));
vi.mock("./api",()=>({obterCustos:vi.fn(),escreverCustos:vi.fn(),obterPreparatorios:vi.fn()}));
vi.mock("../../../lib/auth",()=>({getUsuario:()=>JSON.parse(localStorage.getItem("usuario-custos")??"null")}));
const dados=():CustosDTO=>({rotulo:"Custo direto registrado",cobertura:"COMPLETO",situacao:"COMPLETO",totalConhecido:"100.00",componentesPendentes:0,componentes:[{chave:"movimento:m",fonteId:"t",tipoFonte:"TENTATIVA",animalId:"a",data:"2026-10-01",descricao:"Tentativa IA",estadoFato:"VALIDO",participacaoId:"p",finalidade:"REPRODUCAO",natureza:"MATERIAL",estado:"CONHECIDO",valor:"50.00",origemId:"m"}],limitacoes:["Logística não atribuída"],escopo:"TENTATIVA",propriedadeId:1,periodo:{inicio:null,fim:null,referencia:"DATA_DO_FATO"},totalIntegral:null,totalComponentes:1,pagina:1,limite:25,fontes:[{id:"t",tipo:"TENTATIVA",descricao:"Tentativa IA",data:"2026-10-01",origemMaterial:"DOCUMENTADA",versaoClassificacao:2,documentoMaterial:{referencia:"NF 10",evidencia:"Gratuidade comprovada"},classificacao:{finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",valorMaterialDocumentado:"0.00"}}],atribuicoesPreparos:[]});
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem("usuario-custos",JSON.stringify({dono:true,areas:[],flags:[]}));vi.mocked(obterCustos).mockResolvedValue(dados());vi.mocked(escreverCustos).mockResolvedValue({});vi.mocked(obterPreparatorios).mockResolvedValue({itens:[]});});
afterEach(()=>{cleanup();localStorage.clear();});
describe("composição de custos",()=>{
 it("mostra o custo direto e a limitação sem somar a visão inteira novamente",async()=>{render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText(/100,00/);expect(screen.getByText(/Estas visões consultam os mesmos fatos/)).toBeTruthy();expect(screen.getByText("Logística não atribuída")).toBeTruthy();expect(obterCustos).toHaveBeenCalledWith({tentativaId:"t"},1,"","",1,"");});
 it("leitor de Pecuária vê valores, navega por link com aparência secundária e conserva edição restrita",async()=>{
  localStorage.setItem("usuario-custos",JSON.stringify({dono:false,areas:["pecuaria"],flags:["lancar"]}));
  const d=dados();d.componentes[0]={...d.componentes[0],natureza:"SERVICO",origemId:"servico"};vi.mocked(obterCustos).mockResolvedValue(d);
  render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);
  await screen.findByText(/100,00/);
  expect(screen.queryByText("Classificar finalidade e composição")).toBeNull();
  expect(screen.queryByText("Vincular preparatório à tentativa")).toBeNull();
  const origem=screen.getByRole("link",{name:"Ver fato de origem"});
  expect(origem.getAttribute("href")).toBe("/pecuaria/reproducao?animalId=a&propriedadeId=1&fatoId=t");
  expect(origem.className).toContain("border");
  expect(screen.queryByRole("link",{name:"Ver Serviço"})).toBeNull();
  expect(screen.getByText("Ver Serviço").getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Ver Serviço").getAttribute("title")).toBe("Sem acesso a esta área");
 });
 it("valor oculto conserva estado próprio e não oferece editor monetário",async()=>{localStorage.setItem("usuario-custos",JSON.stringify({dono:false,areas:["pecuaria"],flags:["lancar"]}));vi.mocked(obterCustos).mockResolvedValue({...dados(),situacao:"OCULTO",totalConhecido:null,componentes:dados().componentes.map(c=>({...c,valor:null,origemId:null}))});render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar/>);await screen.findByText("Valores ocultos",{selector:"strong"});expect(screen.queryByText(/100,00/)).toBeNull();expect(screen.queryByText("Classificar finalidade e composição")).toBeNull();});
 it("desconhecido não aparece como custo zero e permite filtrar por data do fato",async()=>{vi.mocked(obterCustos).mockResolvedValue({...dados(),cobertura:"DESCONHECIDO",situacao:"DESCONHECIDO",totalConhecido:null});render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar/>);await screen.findByText(/Valor ainda não comprovado/);fireEvent.click(screen.getByRole("button",{name:"Personalizar período dos custos"}));fireEvent.change(screen.getByLabelText("Data inicial"),{target:{value:"2026-09-01"}});fireEvent.click(screen.getByRole("button",{name:"Aplicar período"}));await waitFor(()=>expect(obterCustos).toHaveBeenLastCalledWith({animalId:"a"},1,"2026-09-01","2026-10-18",1,""));expect(screen.queryByText(/^R\$\s*0,00$/)).toBeNull();});
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

it("abre animal nos doze meses inclusivos e aplica finalidade apenas quando informada",async()=>{
 const {rerender}=render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false} finalidadeInicial="REPRODUCAO"/>);
 await screen.findByText(/100,00/);
 expect(obterCustos).toHaveBeenLastCalledWith({animalId:"a"},1,"2025-10-19","2026-10-18",1,"REPRODUCAO");
 rerender(<CustosDiretos participacaoId="p" propriedadeId={1} podeLancar={false}/>);
 await waitFor(()=>expect(obterCustos).toHaveBeenLastCalledWith({participacaoId:"p"},1,"","",1,""));
});
it("permite repetir consulta com falha sem apresentar vazio ou valor antigo",async()=>{
 vi.mocked(obterCustos).mockRejectedValueOnce(new Error("Falha de leitura"));
 render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByText("Falha de leitura");
 expect(screen.queryByText("Nenhum componente registrado neste recorte.")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
 await screen.findByText(/100,00/);
 expect(screen.queryByText("Falha de leitura")).toBeNull();
});
it("organiza componentes em tabela, preservando links, finalidade e valor comprovado zero",async()=>{
 const d=dados(); d.componentes[0]={...d.componentes[0],descricao:"Tentativa IA · ciclo 2 · 1",valor:"0.00"};
 vi.mocked(obterCustos).mockResolvedValue(d);
 render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("table");
 expect(screen.getByRole("columnheader",{name:"Finalidade"})).toBeTruthy();
 expect(screen.getByText("Tentativa IA · ordem 1")).toBeTruthy();
 expect(d.componentes[0].descricao).toBe("Tentativa IA · ciclo 2 · 1");
 expect(screen.getByText(/^R\$\s*0,00$/)).toBeTruthy();
 expect(screen.getByRole("link",{name:"Ver fato de origem"}).getAttribute("href")).toBe("/pecuaria/reproducao?animalId=a&propriedadeId=1&fatoId=t");
});
it("mantém paginação no servidor e reinicia ao trocar finalidade",async()=>{
 vi.mocked(obterCustos).mockResolvedValue({...dados(),totalComponentes:26});
 render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("table");
 fireEvent.click(screen.getByRole("button",{name:"Próxima"}));
 await waitFor(()=>expect(obterCustos).toHaveBeenLastCalledWith({animalId:"a"},1,"2025-10-19","2026-10-18",2,""));
 fireEvent.change(screen.getByLabelText("Finalidade do custo"),{target:{value:"SANIDADE"}});
 await waitFor(()=>expect(obterCustos).toHaveBeenLastCalledWith({animalId:"a"},1,"2025-10-19","2026-10-18",1,"SANIDADE"));
});
it("período invertido fica no rascunho do seletor, sem consultar datas inválidas",async()=>{
 render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("table");
 fireEvent.click(screen.getByRole("button",{name:"Personalizar período dos custos"}));
 fireEvent.change(screen.getByLabelText("Data inicial"),{target:{value:"2026-10-18"}});
 fireEvent.change(screen.getByLabelText("Data final"),{target:{value:"2026-10-01"}});
 expect(screen.getByRole("button",{name:"Aplicar período"})).toHaveProperty("disabled",true);
 expect(obterCustos).toHaveBeenCalledTimes(1);
});
it("mantém origem de aplicação, exame, participação e consumo sem inferir pelo texto",async()=>{
 const d=dados();
 d.componentes=(["APLICACAO","EXAME","PARTICIPACAO","NUTRICAO"] as const).map((tipoFonte,i)=>({...d.componentes[0],tipoFonte,fonteId:`fonte${i}`,chave:`componente${i}`,descricao:"Descrição preservada"}));
 vi.mocked(obterCustos).mockResolvedValue(d);
 render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("table");
 expect(screen.getAllByRole("link",{name:"Ver fato de origem"}).map(a=>a.getAttribute("href"))).toEqual([
  "/pecuaria/sanidade?animalId=a&propriedadeId=1&detalheTipo=aplicacao&detalheId=fonte0",
  "/pecuaria/sanidade?animalId=a&propriedadeId=1&detalheTipo=exame&detalheId=fonte1",
  "/pecuaria/sanidade?animalId=a&propriedadeId=1&detalheTipo=execucao&detalheId=fonte2",
  "/pecuaria/rebanho/animais/a#nutricao",
 ]);
});

it("distingue recorte vazio de custo desconhecido e dispensa título repetido", async () => {
  vi.mocked(obterCustos).mockResolvedValue({ ...dados(), situacao: "DESCONHECIDO", cobertura: "DESCONHECIDO", componentes: [], totalComponentes: 0, totalConhecido: null });
  render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false} mostrarTitulo={false}/>);
  await screen.findByText("Nenhum custo neste recorte");
  expect(screen.queryByText(/Valor ainda não comprovado/)).toBeNull();
  expect(screen.queryByRole("heading", { name: "Custos diretos" })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Páginas dos componentes" })).toBeNull();
});
it("mantém custo não comprovado quando há componentes com valor desconhecido", async () => {
  vi.mocked(obterCustos).mockResolvedValue({ ...dados(), situacao: "DESCONHECIDO", totalConhecido: null });
  render(<CustosDiretos animalId="a" propriedadeId={1} podeLancar={false}/>);
  await screen.findByText(/Valor ainda não comprovado/);
  expect(screen.queryByText("Nenhum custo neste recorte")).toBeNull();
});
