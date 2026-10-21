// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AgendaSemanal, agruparTarefasVisuais, inicioSemanaSanitaria, type TarefaVisual } from "./AgendaSemanal";
import { AlternarVisualizacaoSanitaria, useVisualizacaoSanitaria } from "./VisualizacaoSanitaria";
import { CartoesOcorrencias } from "./CartoesOcorrencias";
const req = vi.hoisted(()=>vi.fn());
vi.mock("./api",()=>({reqSanidade:req}));
afterEach(()=>{cleanup();localStorage.clear();window.history.replaceState(null,"","/");vi.clearAllMocks();vi.useRealTimers();});
const tarefa=(id:string,etapa="e",ciclo="c"):TarefaVisual=>({id,etapaId:etapa,previstaPara:"2026-10-21",situacao:"PENDENTE",parametros:{tipo:"APLICACAO",tipoAplicacaoNomeSnapshot:"Vacinação"},execucao:{animalId:id,animal:{id,brinco:id,nome:null},rodada:{id:ciclo,nome:ciclo},protocolo:{nome:"Vacina",versao:1}}});
describe("visões operacionais de Sanidade",()=>{
 it("mantém ciclos, etapas e datas diferentes em grupos distintos",()=>{
  const grupos=agruparTarefasVisuais([tarefa("a"),tarefa("b"),tarefa("c","outra"),tarefa("d","e","outro"),{...tarefa("f"),previstaPara:"2026-10-22"}]);
  expect(grupos.map(g=>g.itens.length)).toEqual([2,1,1,1]);
  expect(inicioSemanaSanitaria("2026-10-25")).toBe("2026-10-19");
 });
 it("preserva busca, período e âncora ao alternar e restaura a preferência",()=>{
  function Alternador(){const v=useVisualizacaoSanitaria("visualTarefas");return <AlternarVisualizacaoSanitaria rotulo="Visão" semana {...v}/>;}
  window.history.replaceState(null,"","/pecuaria/sanidade?buscaAnimal=A&de=2026-10-01#grupo");
  const tela=render(<Alternador/>);fireEvent.click(screen.getByRole("button",{name:"Tabela"}));
  expect(window.location.search).toContain("buscaAnimal=A");expect(window.location.search).toContain("de=2026-10-01");expect(window.location.hash).toBe("#grupo");
  tela.unmount();window.history.replaceState(null,"","/pecuaria/sanidade");render(<Alternador/>);expect(screen.getByRole("button",{name:"Tabela"}).getAttribute("aria-pressed")).toBe("true");
 });
 it("consulta dias dentro dos filtros, pagina atrasos sem chamar de resumo completo e executa só as selecionadas",async()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  window.history.replaceState(null,"","/pecuaria/sanidade?semanaSanitaria=2026-10-19");
  req.mockImplementation((url:string)=>{const p=new URLSearchParams(url.split("?")[1]);return Promise.resolve({itens:[tarefa("a"),tarefa("b")],total:p.get("situacao")==="ATRASADA"?75:2,pagina:1,porPagina:50});});
  const executar=vi.fn();render(<AgendaSemanal<TarefaVisual> filtros={{buscaAnimal:"Mimosa",de:"2026-10-20",ate:"2026-10-22"}} revisao={0} podeLancar acoes={()=>null} regularizacao={()=>null} onExecutar={executar}/>);
  await screen.findByText(/Grupos desta página/);
  const urls=req.mock.calls.map(c=>new URLSearchParams(String(c[0]).split("?")[1]));
  expect(urls.every(p=>p.get("buscaAnimal")==="Mimosa")).toBe(true);
  expect(urls.filter(p=>p.get("situacao")!=="ATRASADA").map(p=>p.get("de"))).toEqual(["2026-10-20","2026-10-21","2026-10-22"]);
  fireEvent.click(screen.getAllByRole("button",{name:/Vacinação.*Ver tarefas/})[0]);
  fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar tarefa de a"}));fireEvent.click(screen.getByRole("button",{name:"Executar selecionadas (1)"}));expect(executar.mock.calls[0][0].map((t:TarefaVisual)=>t.id)).toEqual(["a"]);
  const atrasos=screen.getByRole("region",{name:"Tarefas atrasadas"});fireEvent.click(within(atrasos).getByRole("button",{name:"Próxima página"}));await waitFor(()=>expect(req.mock.calls.some(c=>String(c[0]).includes("pagina=2"))).toBe(true));
 });
 it("mostra agregado do servidor independente da quantidade de cartões e filtra por doença",()=>{
  const filtrar=vi.fn();const abrir=vi.fn();render(<CartoesOcorrencias itens={[{id:"o",animalId:"a",inicio:"2026-10-16",fim:null,status:"VALIDO",doenca:{id:"d",nome:"Mastite"},desfecho:null}]} resumo={{abertas:80,encerradas:10,anuladas:1,porDoenca:[{id:"d",nome:"Mastite",quantidade:80}]}} nomeAnimal={()=>"Aurora"} acoes={()=>null} onAbrir={abrir} doencaId="" onDoenca={filtrar}/>);
  expect(screen.getByText("80 ocorrências abertas no recorte filtrado")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:/Mastite.*80/}));expect(filtrar).toHaveBeenCalledWith("d");fireEvent.click(screen.getByRole("button",{name:"Ver ocorrência"}));expect(abrir).toHaveBeenCalled();
 });
});
