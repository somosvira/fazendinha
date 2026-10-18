// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "./propriedadeScope";
import { setSessao, type UsuarioSessao } from "./lib/auth";

vi.mock("./components/AppSidebar", () => ({
  AppSidebar: (props: { propAtiva: number | null; onNav: (tab: "gerencial" | "config") => void }) => <aside>
    <span>Sítio ativo: {props.propAtiva ?? "consolidado"}</span>
    <button onClick={() => props.onNav("gerencial")}>Abrir painel</button>
    <button onClick={() => props.onNav("config")}>Abrir configurações</button>
  </aside>,
}));
vi.mock("./gerencial/PainelGerencial", () => ({
  PainelGerencial: ({ propriedadeId }: { propriedadeId: number | null }) => <p>Painel sítio: {propriedadeId ?? "consolidado"}</p>,
}));
vi.mock("./components/ConfiguracoesHub", () => ({ ConfiguracoesHub: () => <p>Configurações abertas</p> }));
vi.mock("./estoque/ProdutoEstoqueDetalhe", () => ({ ProdutoEstoqueDetalhe: () => <p>Origem de estoque</p> }));
vi.mock("./api/auth", () => ({ fetchMe: vi.fn(() => new Promise(() => {})), logout: vi.fn() }));
vi.mock("./financeiro/rascunhoAtivo", async original => ({
  ...await original<typeof import("./financeiro/rascunhoAtivo")>(),
  useRascunhoAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }),
}));
vi.mock("./financeiro/rascunhoRelatorioAtivo", async original => ({
  ...await original<typeof import("./financeiro/rascunhoRelatorioAtivo")>(),
  useRascunhoRelatorioAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }),
}));
vi.mock("./components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("./components/ChatWidget", () => ({ ChatWidget: () => null }));

const usuario: UsuarioSessao = {
  id: 5, nome: "Gestor", email: "gestor@example.test", papel: "proprietario", dono: true,
  abas: ["dashboard"], areas: ["pecuaria", "financeiro"], flags: [], status: "ATIVO",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setSessao("token-teste", usuario);
  setPropriedadeAtiva(2);
  window.history.replaceState(null, "", "/configuracoes");
});
afterEach(() => { cleanup(); localStorage.clear(); setPropriedadeAtiva(null); });

describe("App — contexto do painel administrativo", () => {
  it("mantém o sítio selecionado ao entrar pelo menu e ao voltar pelo histórico", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir painel" }));
    await screen.findByText("Painel sítio: 2");
    await waitFor(() => expect(new URLSearchParams(location.search).get("propriedadeId")).toBe("2"));
    expect(getPropriedadeAtiva()).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Abrir configurações" }));
    await screen.findByText("Configurações abertas");
    await act(async () => { window.history.back(); });
    await screen.findByText("Painel sítio: 2");
    expect(new URLSearchParams(location.search).get("propriedadeId")).toBe("2");
    expect(getPropriedadeAtiva()).toBe(2);
  });

  it("interpreta acesso direto sem sítio como consolidado mesmo após outra seleção", async () => {
    window.history.replaceState(null, "", "/gerencial");
    render(<App />);
    await screen.findByText("Painel sítio: consolidado");
    expect(getPropriedadeAtiva()).toBeNull();
  });

  it("restaura o sítio explícito da URL ao carregar o painel", async () => {
    window.history.replaceState(null, "", "/gerencial?propriedadeId=1");
    render(<App />);
    await screen.findByText("Painel sítio: 1");
    expect(getPropriedadeAtiva()).toBe(1);
  });

  it("não altera a inicialização do escopo de outras páginas", async () => {
    window.history.replaceState(null, "", "/configuracoes?propriedadeId=1");
    render(<App />);
    await screen.findByText("Sítio ativo: 2");
    expect(getPropriedadeAtiva()).toBe(2);
  });

  it("restaura o sítio do link de origem em uma carga completa do detalhe de estoque", async () => {
    setPropriedadeAtiva(null);
    window.history.replaceState(null, "", "/estoque/produtos/produto-teste?propriedadeId=1");
    render(<App />);
    await screen.findByText("Origem de estoque");
    expect(getPropriedadeAtiva()).toBe(1);
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
  });
});
