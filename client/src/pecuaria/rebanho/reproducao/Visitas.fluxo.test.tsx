// @vitest-environment jsdom
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Visitas } from "./Visitas";
import { criarVisita, obterVisita, type AtividadeVisita, type Visita } from "./visitas-api";
import { chaveGrupo } from "./planner-api";
import { criteriosVazios } from "./EditorSelecaoVisita";
import { grupoLivre } from "./SelecaoLivreVisita";
const mocks = vi.hoisted(() => ({ guarda: vi.fn<() => Promise<boolean>>(), desmontou: vi.fn() }));
vi.mock("../../../api/propriedades", () => ({ usePropriedades: () => ({ data: [{ id: 1, nome: "Principal", ativo: true }] }) }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), criarVisita: vi.fn(), obterVisita: vi.fn(), listarVisitas: vi.fn().mockResolvedValue([]) }));
vi.mock("./TranscricaoVisita", () => ({ Transcricao: ({ atividade, registrarGuardaSaida }: { atividade: AtividadeVisita; registrarGuardaSaida?: (fn: (() => Promise<boolean>) | null) => void }) => {
  useEffect(() => { registrarGuardaSaida?.(mocks.guarda); return () => { registrarGuardaSaida?.(null); mocks.desmontou(atividade.id); }; }, [atividade.id, registrarGuardaSaida]);
  return <p>Atendimento ativo {atividade.id}</p>;
} }));
vi.mock("./PlannerVisita", () => ({ PlannerVisita: () => <p>Planner ativo</p> }));
vi.mock("./FolhaVisita", () => ({ FolhaVisita: () => null }));
vi.mock("./FormAtividadeVisita", () => ({ FormAtividade: () => null }));
const atividades: AtividadeVisita[] = ["a1", "a2"].map(id => ({ id, tipo: "AVALIACAO_REPRODUTIVA", nome: `Grupo ${id}`, extra: false, participantes: [] }));
const visita: Visita = { id: "visita", nome: "Atendimento do dia", propriedadeId: 1, data: "2026-10-15", status: "ABERTA", atividades, impressoes: [] };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mocks.guarda.mockResolvedValue(true); vi.mocked(obterVisita).mockResolvedValue(visita); window.history.replaceState({}, "", "/pecuaria/visitas/visita?etapa=atendimento&atividade=a1"); });
afterEach(cleanup);
function pendente() { let resolver!: (value: boolean) => void; const promessa = new Promise<boolean>(resolve => { resolver = resolve; }); return { promessa, resolver }; }
describe("páginas de visita e guarda de rascunho", () => {
  it("aguarda o salvamento antes de desmontar a atividade na troca por botão", async () => {
    const p = pendente(); mocks.guarda.mockReturnValue(p.promessa);
    render(<Visitas podeLancar/>); await screen.findByText("Atendimento ativo a1");
    fireEvent.click(screen.getByRole("button", { name: /Grupo a2/ }));
    await waitFor(()=>expect(mocks.guarda).toHaveBeenCalledTimes(1)); expect(mocks.desmontou).not.toHaveBeenCalled();
    expect(screen.getByText("Atendimento ativo a1")).toBeTruthy();
    p.resolver(true); await screen.findByText("Atendimento ativo a2");
    expect(mocks.desmontou).toHaveBeenCalledWith("a1");
  });
  it("mantém atividade e endereço quando a gravação recusa a navegação", async () => {
    mocks.guarda.mockResolvedValue(false); render(<Visitas podeLancar/>); await screen.findByText("Atendimento ativo a1");
    fireEvent.click(screen.getByRole("button", { name: /Grupo a2/ }));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Atendimento ativo a1")).toBeTruthy(); expect(mocks.desmontou).not.toHaveBeenCalled();
    expect(new URLSearchParams(location.search).get("atividade")).toBe("a1");
  });
  it("popstate não desmonta antecipadamente e restaura endereço quando o salvamento falha", async () => {
    const p = pendente(); mocks.guarda.mockReturnValue(p.promessa);
    render(<Visitas podeLancar/>); await screen.findByText("Atendimento ativo a1");
    window.history.pushState({}, "", "/pecuaria/visitas/visita?etapa=atendimento&atividade=a2");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledTimes(1)); expect(mocks.desmontou).not.toHaveBeenCalled();
    p.resolver(false); await waitFor(() => expect(new URLSearchParams(location.search).get("atividade")).toBe("a1"));
    expect(screen.getByText("Atendimento ativo a1")).toBeTruthy(); expect(mocks.desmontou).not.toHaveBeenCalled();
  });
  it("trata nova antes de consultar um ID e oferece cadastro em página", async () => {
    window.history.replaceState({}, "", "/pecuaria/visitas/nova"); render(<Visitas podeLancar/>);
    await screen.findByRole("heading", { name: "Como deseja montar a visita?" }); expect(obterVisita).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("não reabre planejamento de uma visita encerrada por query manual", async () => {
    vi.mocked(obterVisita).mockResolvedValue({ ...visita, status: "ENCERRADA" });
    window.history.replaceState({}, "", "/pecuaria/visitas/visita?etapa=revisao&grupo=qualquer"); render(<Visitas podeLancar/>);
    await screen.findByRole("heading", { name: "Visita encerrada" }); expect(screen.queryByText("Planner ativo")).toBeNull();
  });
  it("volta do atendimento ao grupo livre preparado pela URL preservada",async()=>{
    const grupo=grupoLivre(criteriosVazios());
    vi.mocked(obterVisita).mockResolvedValue({...visita,atividades:[{...atividades[0],contexto:{grupoPlanner:grupo,percursoVisita:{versao:1,origem:"LIVRE"}}}]});
    render(<Visitas podeLancar/>);
    await screen.findByText("Atendimento ativo a1");
    fireEvent.click(screen.getByRole("button",{name:"Rever grupo"}));
    await screen.findByText("Planner ativo");
    expect(new URLSearchParams(location.search).get("etapa")).toBe("revisao");
    expect(new URLSearchParams(location.search).get("grupo")).toBe(chaveGrupo(grupo));
    expect(sessionStorage.getItem("fazendinha:visitas:filtros:sessao:1:visita")).toBeNull();
  });
});

describe("entrada independente de visitas",()=>{
 it("só cria ao continuar e reutiliza a chave após falha de resposta",async()=>{
  window.history.replaceState({},"","/pecuaria/visitas/nova");vi.mocked(criarVisita).mockRejectedValueOnce(new Error("Falha simulada")).mockResolvedValueOnce(visita);
  render(<Visitas podeLancar/>);await screen.findByRole("heading",{name:"Como deseja montar a visita?"});
  expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Nome da visita"),{target:{value:"Visita de teste"}});fireEvent.change(screen.getByLabelText("Sítio"),{target:{value:"1"}});
  fireEvent.click(screen.getByRole("radio",{name:/Agenda do dia/}));expect(criarVisita).not.toHaveBeenCalled();
  fireEvent.submit(document.querySelector("#entrada-visita")!);await screen.findByText("Falha simulada");
  const chave=vi.mocked(criarVisita).mock.calls[0][0].chave;expect(chave).toBeTruthy();fireEvent.submit(document.querySelector("#entrada-visita")!);
  await screen.findByText("Planner ativo");expect(criarVisita).toHaveBeenCalledTimes(2);expect(vi.mocked(criarVisita).mock.calls[1][0].chave).toBe(chave);
 });
 it("abre visita vazia sem modo na entrada, sem escolher um caminho",async()=>{
  vi.mocked(obterVisita).mockResolvedValue({...visita,atividades:[]});window.history.replaceState({},"","/pecuaria/visitas/visita");render(<Visitas podeLancar/>);
  await screen.findByRole("heading",{name:"Como deseja montar a visita?"});expect(location.search).toContain("etapa=entrada");expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0);
 });
});
