// @vitest-environment jsdom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TarefaOperacional } from "./api";
import { EditorExecucaoManejo } from "./EditorExecucaoManejo";
const m=vi.hoisted(()=>({req:vi.fn()}));
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),reqProtocolo:m.req}));
vi.mock("../../../financeiro/PainelCadastro",()=>({classeInput:"input",PainelCadastro:({titulo,children,rodape}:{titulo:string;children:ReactNode;rodape:ReactNode})=><section><h2>{titulo}</h2>{children}{rodape}</section>}));
function tarefa(tipo="MANEJO"):TarefaOperacional {const animal={id:"animal",brinco:"123",nome:null};return{id:"tarefa",tarefaId:"tarefa",participacaoId:"participacao",etapaId:"etapa",animal,propriedadeId:7,situacao:"SEM_REGISTRO",previstaPara:"2026-10-01",previsaoOriginal:null,previsaoIndividual:false,precisaoTemporal:"DIA",realizadaEm:null,precisaoRealizacao:null,previsaoPendente:false,ultimoEvento:null,vinculoAtual:null,acoes:{atender:true,justificar:true,adiar:true,retificar:false,regularizar:false},tarefaOrigem:{id:"tarefa",etapaId:"etapa",execucaoId:"participacao",tipo,previstaEm:"2026-10-01",previstaPara:"2026-10-01",status:"PENDENTE",situacao:"PENDENTE",parametros:{tipo:"APLICACAO"},execucao:{animalId:animal.id,propriedadeId:7,animal,protocolo:{nome:"Manejo",versao:1}}}};}
const previa={fingerprint:"a".repeat(64),tarefas:{itens:[{tarefaId:"tarefa",animalId:"animal",motivoObrigatorio:false,motivo:null,inicioLegado:{exigeCiencia:false,total:0}}],total:1,pagina:1,porPagina:10}};
beforeEach(()=>{vi.clearAllMocks();m.req.mockImplementation((p:string)=>Promise.resolve(p.startsWith("/tarefas")?{itens:[],total:0,pagina:1,porPagina:10}:previa));});afterEach(cleanup);
describe("formulário real manejo/retirada",()=>{
 it("dia sem hora usa o mesmo contrato e confirma só após conferir",async()=>{render(<EditorExecucaoManejo tarefas={[tarefa()]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));await screen.findByRole("button",{name:"Confirmar conjunto"});const c=m.req.mock.calls.find(c=>c[0]==="/execucoes/previa")!;expect(c[2].itens).toEqual([{tipo:"MANEJO",animalId:"animal",propriedadeId:7,tarefaId:"tarefa",data:"2026-10-01",responsavel:undefined,observacao:undefined,operacaoServicoId:undefined}]);expect(m.req.mock.calls.some(c=>c[0]==="/execucoes/confirmar")).toBe(false);});
 it("retirada não escolhe primeira inserção automaticamente e bloqueia envio sem origem",async()=>{m.req.mockImplementation((p:string)=>Promise.resolve({itens:p.includes("insercoes")?[{id:"insercao",data:"2026-09-30",nomeProdutoAplicado:"Dispositivo"}]:[],total:p.includes("insercoes")?1:0,pagina:1,porPagina:10}));render(<EditorExecucaoManejo tarefas={[tarefa("RETIRADA")]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);await screen.findByRole("option",{name:"2026-09-30 · Dispositivo"});expect(screen.getByLabelText<HTMLSelectElement>("Inserção do dispositivo deste animal").value).toBe("");fireEvent.submit(document.getElementById("execucao-manejo")!);await screen.findByText("Selecione a inserção do animal 123.");expect(m.req.mock.calls.some(c=>c[0]==="/execucoes/previa")).toBe(false);});
 it("propõe a origem única validada pelo servidor, sem gravar antes da confirmação",async()=>{
  m.req.mockImplementation((p:string)=>Promise.resolve(p.startsWith("/tarefas")?{itens:p.includes("/insercoes?")?[{id:"insercao",data:"2026-09-30",nomeProdutoAplicado:"Dispositivo"}]:[],total:p.includes("/insercoes?")?1:0,pagina:1,porPagina:10,...(p.includes("/insercoes?")?{sugestaoInsercaoId:"insercao",situacaoOrigem:"UNIVOCA"}:{})}:previa));
  render(<EditorExecucaoManejo tarefas={[tarefa("RETIRADA")]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByLabelText<HTMLSelectElement>("Inserção do dispositivo deste animal").value).toBe("insercao"));
  expect(m.req.mock.calls.some(c=>c[0]==="/execucoes/confirmar")).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
  await screen.findByRole("button",{name:"Confirmar conjunto"});
  expect(m.req.mock.calls.find(c=>c[0]==="/execucoes/previa")![2].itens[0].insercaoAplicacaoId).toBe("insercao");
 });
 it("duas origens válidas exigem escolha explícita e trocar data descarta a proposta anterior",async()=>{
  m.req.mockImplementation((p:string)=>Promise.resolve({itens:p.includes("/insercoes?")?[{id:"insercao",data:"2026-09-30",nomeProdutoAplicado:"Dispositivo"}]:[],total:p.includes("/insercoes?")?2:0,pagina:1,porPagina:10,sugestaoInsercaoId:null,situacaoOrigem:"AMBIGUA"}));
  render(<EditorExecucaoManejo tarefas={[tarefa("RETIRADA")]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await screen.findByText("Há mais de uma inserção válida. Escolha a origem efetivamente retirada.");
  expect(screen.getByLabelText<HTMLSelectElement>("Inserção do dispositivo deste animal").value).toBe("");
  fireEvent.submit(document.getElementById("execucao-manejo")!);
  await screen.findByText("Selecione a inserção do animal 123.");
  expect(m.req.mock.calls.some(c=>c[0]==="/execucoes/previa")).toBe(false);
  fireEvent.change(screen.getByLabelText("Data realizada · conjunto"),{target:{value:"2026-10-02"}});
  await waitFor(()=>expect(m.req.mock.calls.some(c=>c[0].includes("realizadaEm=2026-10-02"))).toBe(true));
 });
 it("prepara inserções de 14 animais mesmo com somente dez visíveis",async()=>{
  const tarefas=Array.from({length:14},(_,n)=>{const t=tarefa("RETIRADA");return{...t,id:`tarefa-${n}`,tarefaId:`tarefa-${n}`,animal:{...t.animal,id:`animal-${n}`,brinco:`RT${n}`},tarefaOrigem:{...t.tarefaOrigem,id:`tarefa-${n}`}};});
  m.req.mockImplementation((p:string)=>{const insercao=p.includes("/insercoes?");const id=p.split("/")[2];return Promise.resolve(p.startsWith("/tarefas")?{itens:insercao?[{id:`insercao-${id}`,data:"2026-09-30",nomeProdutoAplicado:"Dispositivo"}]:[],total:insercao?1:0,pagina:1,porPagina:10,sugestaoInsercaoId:insercao?`insercao-${id}`:null,situacaoOrigem:insercao?"UNIVOCA":undefined}:{...previa,tarefas:{...previa.tarefas,total:14}});});
  render(<EditorExecucaoManejo tarefas={tarefas} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole<HTMLButtonElement>("button",{name:"Conferir execução"}).disabled).toBe(false));
  expect(screen.getAllByLabelText("Inserção do dispositivo deste animal")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
  await screen.findByRole("button",{name:"Confirmar conjunto"});
  const itens=m.req.mock.calls.find(c=>c[0]==="/execucoes/previa")![2].itens;
  expect(itens).toHaveLength(14);
  expect(itens[13].insercaoAplicacaoId).toBe("insercao-tarefa-13");
 });

 it("exibe valor somente com permissão e edição da data invalida conferência",async()=>{render(<EditorExecucaoManejo tarefas={[tarefa()]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);expect(screen.queryByLabelText("Valor do Serviço atribuído por animal (opcional)")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));await screen.findByRole("button",{name:"Confirmar conjunto"});fireEvent.change(screen.getByLabelText("Data realizada · conjunto"),{target:{value:"2026-10-02"}});await waitFor(()=>expect(screen.getByRole("button",{name:"Conferir execução"})).toBeTruthy());});
 it("coletivo14 pagina os ajustes sem perder o envelope inteiro",async()=>{const tarefas=Array.from({length:14},(_,n)=>{const t=tarefa();return{...t,id:`tarefa-${n}`,tarefaId:`tarefa-${n}`,animal:{...t.animal,id:`animal-${n}`,brinco:`MJ${n}`},tarefaOrigem:{...t.tarefaOrigem,id:`tarefa-${n}`}};});m.req.mockImplementation((p:string)=>Promise.resolve(p.startsWith("/tarefas")?{itens:[],total:0,pagina:1,porPagina:10}:{...previa,tarefas:{itens:tarefas.slice(0,10).map(t=>({...previa.tarefas.itens[0],tarefaId:t.id,animalId:t.animal.id})),total:14,pagina:1,porPagina:10}}));render(<EditorExecucaoManejo tarefas={tarefas} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);expect(screen.getAllByText("Ajustar dados deste animal")).toHaveLength(10);fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));await screen.findByRole("button",{name:"Confirmar conjunto"});const e=m.req.mock.calls.find(c=>c[0]==="/execucoes/previa")![2];expect(e.itens).toHaveLength(14);expect(new Set(e.itens.map((i:{animalId:string})=>i.animalId)).size).toBe(14);});
 it("reconhecimento histórico exige escolha, evidência e ciência explícitas",async()=>{render(<EditorExecucaoManejo tarefas={[tarefa("RETIRADA")]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Regularizar inserção histórica existente"}));expect(screen.getByRole<HTMLButtonElement>("button",{name:"Reconhecer inserção"}).disabled).toBe(true);expect(screen.getByLabelText("Evidência da inserção")).toBeTruthy();expect(m.req.mock.calls.some(c=>c[0].includes("reconhecer-insercao"))).toBe(false);});

});
