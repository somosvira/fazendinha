// @vitest-environment jsdom
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Visitas } from "./Visitas";
import { listarVisitas, obterVisita, type AtividadeVisita, type Visita } from "./visitas-api";
import { reqV4 } from "./api";

const mocks = vi.hoisted(() => ({ guarda: vi.fn<() => Promise<boolean>>() }));
vi.mock("../../../api/propriedades", () => ({ usePropriedades: () => ({ data: [{ id: 1, nome: "Principal", ativo: true }] }) }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), obterVisita: vi.fn(), listarVisitas: vi.fn().mockResolvedValue([]) }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqV4: vi.fn().mockResolvedValue({}) }));
vi.mock("./TranscricaoVisita", () => ({ Transcricao: ({ atividade, registrarGuardaSaida }: { atividade: AtividadeVisita; registrarGuardaSaida?: (fn: (() => Promise<boolean>) | null) => void }) => {
  useEffect(() => { registrarGuardaSaida?.(mocks.guarda); return () => registrarGuardaSaida?.(null); }, [atividade.id, registrarGuardaSaida]);
  return <p>Atendimento ativo {atividade.id}</p>;
} }));
vi.mock("./PlannerVisita", () => ({ PlannerVisita: ({onExtra}: {onExtra?:()=>void}) => <><p>Planner ativo</p><button onClick={onExtra}>Adicionar atendimento extra</button></> }));
vi.mock("./FolhaVisita", () => ({ FolhaVisita: () => null }));
vi.mock("./FormAtividadeVisita", () => ({ FormAtividade: () => <p>Formulário inline de atividade extra</p> }));

const atividades: AtividadeVisita[] = ["a1", "a2"].map(id => ({ id, tipo: "AVALIACAO_REPRODUTIVA", nome: `Grupo ${id}`, extra: false, participantes: [] }));
const visita: Visita = { id: "visita", nome: "Atendimento", propriedadeId: 1, data: "2026-10-15", status: "ABERTA", atividades, impressoes: [] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.guarda.mockResolvedValue(true);
  vi.mocked(obterVisita).mockResolvedValue(visita);
  window.history.replaceState({}, "", "/pecuaria/visitas/visita?etapa=atendimento&atividade=a1");
});
afterEach(cleanup);

describe("intenções concorrentes de navegação da visita", () => {
  it("abre o detalhe a partir do resumo da lista sem exigir atividades no GET inicial", async () => {
    vi.mocked(listarVisitas).mockResolvedValue([{ id: visita.id, propriedadeId: visita.propriedadeId, nome: visita.nome, data: visita.data, status: visita.status }]);
    window.history.replaceState({}, "", "/pecuaria/visitas");
    render(<Visitas podeLancar/>);
    fireEvent.click(await screen.findByRole("button", { name: /Atendimento.*15\/10\/2026/ }));
    await screen.findByText("Atendimento ativo a1");
    expect(obterVisita).toHaveBeenCalledWith("visita");
  });

  it("retorna à escolha do percurso com guarda quando a origem antiga é desconhecida", async () => {
    render(<Visitas podeLancar/>); await screen.findByText("Atendimento ativo a1");
    fireEvent.click(screen.getByRole("button", {name:"Rever grupo"}));
    await screen.findByRole("heading",{name:/Nova visita|Adicionar grupo/});
    expect(mocks.guarda).toHaveBeenCalledOnce();
    expect(screen.queryByText("Formulário inline de atividade extra")).toBeNull();
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0);
    fireEvent.click(screen.getByRole("radio",{name:/Agenda do dia/}));
    fireEvent.click(screen.getByRole("button",{name:"Continuar para a agenda"}));
    await screen.findByText("Planner ativo");
    expect(new URLSearchParams(location.search).get("modo")).toBe("agenda");
  });

  it("não encerra a visita enquanto a guarda de rascunho estiver pendente ou rejeitar", async () => {
    let concluir!: (ok: boolean) => void;
    mocks.guarda.mockReturnValue(new Promise<boolean>(resolve => { concluir = resolve; }));
    render(<Visitas podeLancar/>);
    await screen.findByText("Atendimento ativo a1");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar visita" }));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledOnce());
    expect(reqV4).not.toHaveBeenCalled();
    concluir(false);
    await waitFor(() => expect(screen.getByRole("button", { name: "Encerrar visita" })).toBeTruthy());
    expect(reqV4).not.toHaveBeenCalled();
    expect(screen.getByText("Atendimento ativo a1")).toBeTruthy();
  });

  it("não deixa a resposta de um popstate antigo reverter o destino mais recente", async () => {
    let concluir!: (ok: boolean) => void;
    mocks.guarda.mockReturnValue(new Promise<boolean>(resolve => { concluir = resolve; }));
    render(<Visitas podeLancar/>);
    await screen.findByText("Atendimento ativo a1");

    window.history.pushState({}, "", "/financeiro?status=abertas");
    fireEvent(window, new PopStateEvent("popstate"));
    await Promise.resolve();
    window.history.pushState({}, "", "/estoque?busca=sal");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(mocks.guarda).toHaveBeenCalledOnce();
    expect(screen.getByText("Atendimento ativo a1")).toBeTruthy();

    concluir(true);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Visitas veterinárias" })).toBeTruthy());
    expect(window.location.pathname + window.location.search).toBe("/estoque?busca=sal");
    expect(screen.queryByText("Atendimento ativo a1")).toBeNull();
  });
});
