// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { AppSidebar, TrabalhoAtivo } from "./AppSidebar";
import type { User } from "@/data/acessos";

vi.mock("../rebanho/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../rebanho/api")>()),
  usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const usuario: User = { id: "1", nome: "Ana", email: "ana@exemplo.com", inicial: "A", papel: "personalizado", status: "ativo", ultimoAcesso: "", abas: ["dashboard", "lancar"], areas: ["financeiro"], flags: [] };
const resumo = { titulo: "Ração para o gado", detalhe: "R$ 1.250,00 · Compra para estoque", atualizadoEm: new Date(Date.now() - 5 * 60_000).toISOString() };

function renderSidebar(props: Partial<ComponentProps<typeof AppSidebar>> = {}) {
  const base: ComponentProps<typeof AppSidebar> = {
    current: "dashboard", onNav: vi.fn(), financeiro: [{ id: "dashboard", label: "Visão geral" }, { id: "lancar", label: "Operações" }],
    isAdmin: false, podeVerFolha: false, areas: ["financeiro"], mobileOpen: false, onMobileToggle: vi.fn(), onAbrirBusca: vi.fn(),
    propAtiva: null, onTrocarProp: vi.fn(), user: usuario, colapsada: false, onToggleColapsar: vi.fn(), onAcessos: vi.fn(),
  };
  const final = { ...base, ...props };
  render(<AppSidebar {...final} />);
  return final;
}

describe("AppSidebar — trabalho ativo", () => {
  it("mostra o rascunho acima do Financeiro e abre o formulário ao clicar", () => {
    const onAbrir = vi.fn();
    const props = renderSidebar({ trabalhoAtivo: { resumo, ativo: false, onAbrir } });

    const bloco = screen.getByRole("group", { name: "Trabalho ativo" });
    const financeiro = screen.getByRole("button", { name: /Financeiro$/ });
    expect(bloco.compareDocumentPosition(financeiro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Ração para o gado")).toBeTruthy();
    expect(screen.getByText("R$ 1.250,00 · Compra para estoque")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar rascunho: Ração para o gado" }));
    expect(onAbrir).toHaveBeenCalledOnce();
    // No mobile o clique também fecha o drawer, como os demais itens.
    expect(props.onMobileToggle).toHaveBeenCalledWith(false);
  });

  it("não reserva espaço quando não há rascunho", () => {
    renderSidebar({ trabalhoAtivo: null });
    expect(screen.queryByRole("group", { name: "Trabalho ativo" })).toBeNull();
  });
});

describe("TrabalhoAtivo", () => {
  it("indica quando o formulário do rascunho está na tela", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo onAbrir={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Continuar rascunho/ }).getAttribute("aria-current")).toBe("page");
  });

  it("some com os textos no trilho recolhido e deixa só o ícone", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo={false} onAbrir={vi.fn()} />);
    const botao = screen.getByRole("button", { name: /Continuar rascunho/ });
    expect(botao.getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Ração para o gado").parentElement?.className).toContain("[.side-collapsed_&]:hidden");
    expect(screen.getByText("Trabalho ativo").className).toContain("[.side-collapsed_&]:hidden");
  });

  it("atualiza o tempo desde o último salvamento", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 15, 0) });
    const salvo = { ...resumo, atualizadoEm: new Date(2026, 8, 14, 14, 55).toISOString() };
    render(<TrabalhoAtivo resumo={salvo} ativo={false} onAbrir={vi.fn()} />);
    expect(screen.getByText("Rascunho salvo há 5 min")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText("Rascunho salvo há 6 min")).toBeTruthy();
  });

  it("lê o relógio a cada renderização, não só no tique do minuto", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 15, 0) });
    const antigo = { ...resumo, atualizadoEm: new Date(2026, 8, 14, 14, 50).toISOString() };
    const { rerender } = render(<TrabalhoAtivo resumo={antigo} ativo={false} onAbrir={vi.fn()} />);
    // Dado novo chega entre dois tiques (ex.: rascunho salvo em outro aparelho).
    vi.setSystemTime(new Date(2026, 8, 14, 15, 0, 50));
    rerender(<TrabalhoAtivo resumo={{ ...antigo, atualizadoEm: new Date(2026, 8, 14, 14, 53, 30).toISOString() }} ativo={false} onAbrir={vi.fn()} />);
    expect(screen.getByText("Rascunho salvo há 7 min")).toBeTruthy();
  });
});
