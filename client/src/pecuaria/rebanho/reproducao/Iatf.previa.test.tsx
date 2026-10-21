// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorExecucaoManejo } from "../protocolos/EditorExecucaoManejo";
import { reqProtocolo, type TarefaOperacional } from "../protocolos/api";
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn() }));
const animal = {id:"a1",brinco:"123",nome:null};
const tarefa:TarefaOperacional = {id:"t1",tarefaId:"t1",participacaoId:"p1",etapaId:"e1",animal,propriedadeId:1,situacao:"SEM_REGISTRO",previstaPara:"2026-10-01",previsaoOriginal:null,previsaoIndividual:false,precisaoTemporal:"DIA",realizadaEm:null,precisaoRealizacao:null,previsaoPendente:false,ultimoEvento:null,vinculoAtual:null,acoes:{atender:true,justificar:true,adiar:true,retificar:false,regularizar:false},tarefaOrigem:{id:"t1",etapaId:"e1",execucaoId:"p1",tipo:"MANEJO",previstaEm:"2026-10-01",previstaPara:"2026-10-01",status:"PENDENTE",situacao:"PENDENTE",parametros:{tipo:"APLICACAO"},execucao:{animalId:animal.id,propriedadeId:1,animal,protocolo:{nome:"Manejo",versao:1}}}};
const props={tarefas:[tarefa],reprodutivo:true,onFechar:vi.fn(),onSalvo:vi.fn()};
function prepararMock(legado:boolean){
 vi.mocked(reqProtocolo).mockImplementation(async path=>{
  if(path.includes("servicos-manejo"))return{itens:[],total:0,pagina:1,porPagina:10};
  if(path.includes("previa-execucao")){const pagina=Number(new URL(path,"https://local").searchParams.get("pagina"));return{exigeCiencia:legado,modoLegado:legado,itens:legado?Array.from({length:pagina===3?1:10},(_,i)=>({id:`t${(pagina-1)*10+i+1}`,nome:`Etapa ${(pagina-1)*10+i+1}`,previstaAnterior:"2026-10-01",previstaNova:"2026-10-02",precisaoAnterior:"DIA",precisaoNova:"DIA",previsaoPendente:false,previsaoPendenteAnterior:false})):[],total:legado?21:0,pagina,porPagina:10};}
  if(path==="/execucoes/confirmar")return{chave:"c",itens:[{id:"manejo",tipo:"MANEJO",tarefaId:"t1",animalId:"a1"}],total:1,pagina:1,porPagina:10};
  return{fingerprint:"a".repeat(64),tarefas:{itens:[{tarefaId:"t1",animalId:"a1",motivoObrigatorio:false,motivo:null,inicioLegado:{exigeCiencia:legado,total:legado?21:0}}],total:1,pagina:1,porPagina:10}};
 });
}
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("executor comum pagina impactos legados e transmite ciência na confirmação versionada",async()=>{
 prepararMock(true);render(<EditorExecucaoManejo {...props}/>);
 fireEvent.change(screen.getByLabelText("Data realizada · conjunto"),{target:{value:"2026-10-02"}});
 fireEvent.click(screen.getByRole("checkbox",{name:/Confirmo ciência dos alertas/}));
 fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
 await screen.findByText("Etapa 1");expect(screen.queryByText("Etapa 11")).toBeNull();expect(vi.mocked(reqProtocolo).mock.calls.some(([p])=>p==="/execucoes/confirmar")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Próxima"}));await screen.findByText("Etapa 11");
 fireEvent.click(screen.getByRole("checkbox",{name:/Conferi e autorizo/}));
 fireEvent.click(screen.getByRole("button",{name:"Confirmar conjunto"}));
 await waitFor(()=>expect(vi.mocked(reqProtocolo).mock.calls.filter(([p])=>p==="/execucoes/previa")).toHaveLength(2));
 fireEvent.click(screen.getByRole("button",{name:"Confirmar conjunto"}));
 await screen.findByRole("heading",{name:"Manejos registrados"});
 expect(reqProtocolo).toHaveBeenCalledWith("/execucoes/confirmar",1,expect.objectContaining({execucao:expect.objectContaining({versao:1,itens:[expect.objectContaining({tarefaId:"t1",data:"2026-10-02",cienciaRecalendarioLegado:true})]})}));
});
it("nova origem conserva calendário e confirma no executor comum sem ciência legada",async()=>{
 prepararMock(false);render(<EditorExecucaoManejo {...props}/>);
 fireEvent.click(screen.getByRole("checkbox",{name:/Confirmo ciência dos alertas/}));
 fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
 await screen.findByRole("button",{name:"Confirmar conjunto"});expect(screen.queryByRole("checkbox",{name:/Conferi e autorizo/})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Confirmar conjunto"}));await screen.findByRole("heading",{name:"Manejos registrados"});
 expect(reqProtocolo).toHaveBeenCalledWith("/execucoes/confirmar",1,expect.objectContaining({execucao:expect.objectContaining({itens:[expect.objectContaining({data:"2026-10-01",cienciaRecalendarioLegado:false})]})}));
});
