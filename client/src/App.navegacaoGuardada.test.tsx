// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { setPropriedadeAtiva } from "./propriedadeScope";
import { setSessao, type UsuarioSessao } from "./lib/auth";

const mocks = vi.hoisted(() => ({ guarda: vi.fn<() => Promise<boolean>>() }));
vi.mock("./components/AppSidebar", () => ({ AppSidebar: (props: { propAtiva: number | null; onTrocarProp: (id: number) => void; onNav: (tab: "estoque") => void }) => <div>
  <span>Sítio ativo: {props.propAtiva ?? "consolidado"}</span>
  <button onClick={() => props.onTrocarProp(2)}>Trocar para sítio 2</button>
  <button onClick={() => props.onNav("estoque")}>Abrir estoque</button>
</div> }));
vi.mock("./pecuaria/rebanho/reproducao/Visitas", async () => {
  const React = await import("react");
  const { registrarGuardaNavegacao } = await import("./navegacaoGuardada");
  return { Visitas: () => { React.useEffect(() => registrarGuardaNavegacao(mocks.guarda), []); return <p>Tela da visita aberta</p>; } };
});
vi.mock("./pecuaria/rebanho/RebanhoContent", () => ({ RebanhoContent: () => <p>Lista de animais · página {new URLSearchParams(window.location.search).get("page") ?? "1"}</p> }));
vi.mock("./api/auth", () => ({ fetchMe: vi.fn(() => new Promise(() => {})), logout: vi.fn() }));
vi.mock("./financeiro/rascunhoAtivo", async original => ({ ...await original<typeof import("./financeiro/rascunhoAtivo")>(), limparRascunhoAtivo: vi.fn(), useRascunhoAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }) }));
vi.mock("./financeiro/rascunhoRelatorioAtivo", async original => ({ ...await original<typeof import("./financeiro/rascunhoRelatorioAtivo")>(), limparRascunhoRelatorioAtivo: vi.fn(), useRascunhoRelatorioAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }) }));
vi.mock("./financeiro/novo-api", async original => ({ ...await original<typeof import("./financeiro/novo-api")>(), obterRascunhoOperacao: vi.fn().mockResolvedValue(null), obterRascunhoRelatorioFinanceiro: vi.fn().mockResolvedValue(null) }));
vi.mock("./components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("./components/ChatWidget", () => ({ ChatWidget: () => null }));

const usuario: UsuarioSessao = { id: 5, nome: "Pessoa", email: "pessoa@example.test", papel: "proprietario", abas: ["dashboard", "lancar", "gastos", "caixinha", "cadastros", "relatorio"], areas: ["pecuaria", "financeiro", "estoque"], flags: ["lancar", "exportar", "gerenciarAcessos"], status: "ATIVO", dono: true };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guarda.mockResolvedValue(false);
  setPropriedadeAtiva(1);
  setSessao("token-teste", usuario);
  window.history.replaceState({}, "", "/pecuaria/visitas/v1?etapa=atendimento&atividade=a1");
});
afterEach(() => { cleanup(); localStorage.clear(); setPropriedadeAtiva(null); });

describe("guarda de navegação ligada ao App", () => {
  it("mantém o sítio e a tela de visita quando o salvamento recusa a troca", async () => {
    render(<App/>);
    await screen.findByText("Tela da visita aberta");
    fireEvent.click(screen.getByRole("button", { name: "Trocar para sítio 2" }));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledOnce());
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
    expect(screen.getByText("Tela da visita aberta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir estoque" }));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
    expect(screen.getByText("Tela da visita aberta")).toBeTruthy();
  });

  it("espera a gravação antes de mudar sítio e desmontar a tela", async () => {
    let concluir!: (ok: boolean) => void;
    mocks.guarda.mockReturnValue(new Promise<boolean>(resolve => { concluir = resolve; }));
    render(<App/>);
    await screen.findByText("Tela da visita aberta");
    fireEvent.click(screen.getByRole("button", { name: "Trocar para sítio 2" }));
    await waitFor(() => expect(mocks.guarda).toHaveBeenCalledOnce());
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
    expect(screen.getByText("Tela da visita aberta")).toBeTruthy();
    concluir(true);
    await screen.findByText("Sítio ativo: 2");
    await waitFor(() => expect(screen.getByText("Tela da visita aberta")).toBeTruthy());
  });
});

it("reinicia a página dos animais ao trocar o sítio global sem perder outros filtros", async () => {
  window.history.replaceState({}, "", "/pecuaria/rebanho/animais?page=2&sexos=F#lista");
  render(<App/>);
  await screen.findByText("Lista de animais · página 2");
  fireEvent.click(screen.getByRole("button", {name:"Trocar para sítio 2"}));
  await screen.findByText("Sítio ativo: 2");
  expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
  expect(new URLSearchParams(window.location.search).getAll("sexos")).toEqual(["F"]);
  expect(window.location.hash).toBe("#lista");
});
