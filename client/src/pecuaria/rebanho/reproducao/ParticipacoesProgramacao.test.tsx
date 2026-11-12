// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mudarCampo } from "@/lib/controles.fixture";
import { revisarBloqueioParticipacao } from "./revisao-impacto-api";
vi.mock("./revisao-impacto-api", () => ({ revisarBloqueioParticipacao: vi.fn() }));
import { ParticipacoesProgramacao } from "./ParticipacoesProgramacao";
import { reqProtocolo, obterEtapasProtocolo, obterTarefasProtocolo, type TarefaOperacional, type EtapaProtocolo } from "../protocolos/api";
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn(), obterEtapasProtocolo:vi.fn(), obterTarefasProtocolo: vi.fn() }));
afterEach(()=>{cleanup();vi.resetAllMocks();window.history.replaceState({},"","/");});
beforeEach(()=>{
 vi.mocked(reqProtocolo).mockResolvedValue({itens:[{id:"p",animalId:"a",animal:{brinco:"Matriz 1"},encerradoEm:"2026-10-05"}],total:1,pagina:1,porPagina:10});
 vi.mocked(obterEtapasProtocolo).mockResolvedValue({itens:["1","2","3","4"].map(id=>({id,nome:`Etapa ${id}`,diaRelativo:Number(id),unidadeIntervalo:"DIAS"} as EtapaProtocolo)),total:4,pagina:1,porPagina:10});
});
it("mostra fatos por etapa sem transformar atendimento anterior à retirada em X",async()=>{
 vi.mocked(obterTarefasProtocolo).mockResolvedValue({itens:[{etapaId:"1",situacao:"ATENDIDO"},{etapaId:"2",situacao:"RETIRADO"},{etapaId:"3",situacao:"PREVISTO"}] as TarefaOperacional[],total:3,pagina:1,porPagina:10});
 const retirar=vi.fn();render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0} aoRetirar={retirar}/>);
 expect(await screen.findByRole("table",{name:"Participantes por etapa"})).toBeTruthy();
 for(const name of ["Etapa 1: Atendido","Etapa 2: Retirado do protocolo","Etapa 3: Pendente · agendado","Etapa 4: Sem tarefa vinculada"]) expect(screen.getByRole("button",{name})).toBeTruthy();
 expect(screen.queryByText("Gestão das participações")).toBeNull();
 expect(obterTarefasProtocolo).toHaveBeenCalledWith({participacaoId:"p"},{pagina:1},7);
});
it("percorre tarefas paginadas e preserva URL de retorno e contexto da participação",async()=>{
 const origem="/pecuaria/reproducao/programacoes/grupo?sitio=7#participantes";window.history.replaceState({},"",origem);
 vi.mocked(obterTarefasProtocolo).mockResolvedValueOnce({itens:[{etapaId:"1",situacao:"ATENDIDO"}] as TarefaOperacional[],total:2,pagina:1,porPagina:1}).mockResolvedValueOnce({itens:[{etapaId:"2",situacao:"NAO_ATENDIDO"}] as TarefaOperacional[],total:2,pagina:2,porPagina:1});
 render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0}/>);
 await screen.findByRole("button",{name:"Etapa 2: Não atendido"});
 expect(obterTarefasProtocolo).toHaveBeenNthCalledWith(2,{participacaoId:"p"},{pagina:2},7);
 const link=new URL(screen.getByRole("link",{name:"Matriz 1"}).getAttribute("href")!,"http://localhost");
 expect(link.searchParams.get("retorno")).toBe(origem);expect(link.searchParams.get("sitio")).toBe("7");expect(link.searchParams.get("participacaoId")).toBe("p");
});
it("não transforma falha de consulta em ausência de participação",async()=>{
 vi.mocked(obterTarefasProtocolo).mockRejectedValue(new Error("Falha de leitura"));
 render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0}/>);
 expect(await screen.findByText("Falha de leitura")).toBeTruthy();expect(screen.queryByRole("table")).toBeNull();
 vi.mocked(obterTarefasProtocolo).mockResolvedValue({itens:[],total:0,pagina:1,porPagina:10});
 fireEvent.click(screen.getByRole("button",{name:"Atualizar participações individuais"}));
 await waitFor(()=>expect(screen.getByRole("table")).toBeTruthy());
});

const bloqueado = { id: "p", animalId: "a", animal: { brinco: "Matriz 1" }, encerradoEm: null, bloqueadaEm: "2026-11-08T12:00:00.000Z", motivoBloqueio: "Ocorrência exige revisão" };
it("mostra bloqueio na matriz para leitura, sem permitir revisar", async () => {
 vi.mocked(reqProtocolo).mockResolvedValue({ itens: [bloqueado], total: 1, pagina: 1, porPagina: 10 });
 vi.mocked(obterTarefasProtocolo).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
 render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0} podeRevisarBloqueio={false}/>);
 await screen.findByText("Participação bloqueada");
 expect(screen.getByText("Ocorrência exige revisão")).toBeTruthy();
 expect(screen.queryByRole("button", { name: "Revisar bloqueio" })).toBeNull();
});
it("revisão confirmada atualiza participantes e avisa o executor da programação", async () => {
 vi.mocked(reqProtocolo).mockResolvedValueOnce({ itens: [bloqueado], total: 1, pagina: 1, porPagina: 10 }).mockResolvedValue({ itens: [{ ...bloqueado, bloqueadaEm: null, motivoBloqueio: null }], total: 1, pagina: 1, porPagina: 10 });
 vi.mocked(obterTarefasProtocolo).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
 vi.mocked(revisarBloqueioParticipacao).mockResolvedValue({ id: "p", bloqueadaEm: null, canceladaEm: null });
 const atualizar = vi.fn();
 render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0} podeRevisarBloqueio aoRevisarBloqueio={atualizar}/>);
 fireEvent.click(await screen.findByRole("button", { name: "Revisar bloqueio" }));
 mudarCampo(screen.getByLabelText("Decisão sobre a participação"), { target: { value: "RETOMAR" } });
 fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: "Revisão explícita da participação" } });
 fireEvent.click(screen.getByLabelText("Conferi o bloqueio e confirmo a decisão sobre esta participação."));
 fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
 await screen.findByText("Revisão registrada. O bloqueio operacional da participação foi removido.");
 await waitFor(() => expect(screen.queryByText("Participação bloqueada")).toBeNull());
 expect(atualizar).toHaveBeenCalledOnce();
 expect(reqProtocolo).toHaveBeenCalledTimes(2);
});

it("retira pela ação direta da participação aberta", async () => {
 vi.mocked(reqProtocolo).mockResolvedValue({ itens: [{ ...bloqueado, bloqueadaEm: null }], total: 1, pagina: 1, porPagina: 10 });
 vi.mocked(obterTarefasProtocolo).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
 const retirar = vi.fn();
 render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0} aoRetirar={retirar}/>);
 fireEvent.click(await screen.findByRole("button", { name: "Retirar do protocolo: Matriz 1" }));
 expect(retirar).toHaveBeenCalledWith("p");
});
