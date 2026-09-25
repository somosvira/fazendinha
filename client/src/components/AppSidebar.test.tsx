// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { AppSidebar, TrabalhoAtivo } from "./AppSidebar";
import type { User } from "@/data/acessos";

vi.mock("../api/propriedades", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/propriedades")>()),
  usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const usuario: User = { id: "1", nome: "Ana", email: "ana@exemplo.com", inicial: "A", papel: "personalizado", status: "ativo", ultimoAcesso: "", abas: ["dashboard", "lancar"], areas: ["financeiro"], flags: [] };
const resumo = { titulo: "Ração para o gado", tipo: "Compra para estoque", detalhe: "R$ 1.250,00 · Compra para estoque", atualizadoEm: new Date(Date.now() - 5 * 60_000).toISOString() };

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

    const bloco = screen.getByRole("group", { name: "Trabalhos ativos" });
    const financeiro = screen.getByRole("button", { name: /Financeiro$/ });
    expect(bloco.compareDocumentPosition(financeiro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Item fino: descrição e, abaixo, o tipo; o valor fica no tooltip.
    expect(screen.getByText("Ração para o gado")).toBeTruthy();
    expect(screen.getByText("Compra para estoque")).toBeTruthy();
    expect(screen.queryByText("R$ 1.250,00 · Compra para estoque")).toBeNull();
    expect(screen.getByRole("heading", { name: "Trabalhos ativos" })).toBeTruthy();
    const atalho = screen.getByRole("button", { name: "Continuar rascunho: Ração para o gado" });
    expect(atalho.getAttribute("title")).toContain("R$ 1.250,00 · Compra para estoque");

    fireEvent.click(atalho);
    expect(onAbrir).toHaveBeenCalledOnce();
    // No mobile o clique também fecha o drawer, como os demais itens.
    expect(props.onMobileToggle).toHaveBeenCalledWith(false);
  });

  it("não reserva espaço quando não há rascunho", () => {
    renderSidebar({ trabalhoAtivo: null });
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
  });

  it("agrupa operação e relatório sem divisor entre os cards", () => {
    renderSidebar({
      trabalhoAtivo: { resumo, ativo: false, onAbrir: vi.fn() },
      trabalhoAtivoRelatorio: {
        resumo: { ...resumo, titulo: "Relatório financeiro — setembro/2026", tipo: "Relatório financeiro" },
        ativo: false,
        onAbrir: vi.fn(),
      },
    });

    const bloco = screen.getByRole("group", { name: "Trabalhos ativos" });
    expect(within(bloco).getAllByRole("button")).toHaveLength(2);
    expect(bloco.querySelectorAll(".border-b")).toHaveLength(0);
  });
});

describe("TrabalhoAtivo", () => {
  it("anuncia no nome quando o formulário do rascunho está na tela", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo onAbrir={vi.fn()} />);
    const botao = screen.getByRole("button", { name: "Rascunho em edição: Ração para o gado" });
    // A página atual continua sendo o item "Operações"; o cartão não compete com ele.
    expect(botao.getAttribute("aria-current")).toBeNull();
  });

  it("sem rascunho vira um + que começa uma operação nova", () => {
    const onAbrir = vi.fn();
    render(<TrabalhoAtivo resumo={null} ativo={false} onAbrir={onAbrir} />);
    const botao = screen.getByRole("button", { name: "Nova operação" });
    expect(screen.getByText("Nova operação")).toBeTruthy();
    // Sem rascunho não há tipo: uma linha só, na mesma altura mínima do item com rascunho.
    expect(botao.textContent).toBe("Nova operação");
    expect(botao.className).toContain("min-h-[38px]");
    expect(botao.querySelector(".lucide-plus")).toBeTruthy();
    expect(botao.querySelector(".lucide-file-pen-line")).toBeNull();
    fireEvent.click(botao);
    expect(onAbrir).toHaveBeenCalledOnce();
  });

  it("mostra o tipo da operação abaixo da descrição", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo={false} onAbrir={vi.fn()} />);
    const descricao = screen.getByText("Ração para o gado");
    const tipo = screen.getByText("Compra para estoque");
    expect(descricao.compareDocumentPosition(tipo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(descricao.className).toContain("block");
    expect(tipo.className).toContain("block");
  });

  it("com rascunho mostra o lápis no lugar do +", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo={false} onAbrir={vi.fn()} />);
    const botao = screen.getByRole("button", { name: /Continuar rascunho/ });
    expect(botao.querySelector(".lucide-file-pen-line")).toBeTruthy();
    expect(botao.querySelector(".lucide-plus")).toBeNull();
  });

  it("some com a descrição no trilho recolhido e deixa só o ícone", () => {
    render(<TrabalhoAtivo resumo={resumo} ativo={false} onAbrir={vi.fn()} />);
    const botao = screen.getByRole("button", { name: /Continuar rascunho/ });
    expect(botao.getAttribute("aria-current")).toBeNull();
    // Descrição e tipo ficam no mesmo bloco, escondido inteiro no trilho recolhido.
    const bloco = screen.getByText("Ração para o gado").parentElement!;
    expect(bloco.className).toContain("[.side-collapsed_&]:hidden");
    expect(bloco.contains(screen.getByText("Compra para estoque"))).toBe(true);
  });

  it("atualiza o tempo desde o último salvamento", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 15, 0) });
    const salvo = { ...resumo, atualizadoEm: new Date(2026, 8, 14, 14, 55).toISOString() };
    render(<TrabalhoAtivo resumo={salvo} ativo={false} onAbrir={vi.fn()} />);
    const tooltip = () => screen.getByRole("button", { name: /Continuar rascunho/ }).getAttribute("title");
    expect(tooltip()).toContain("Rascunho salvo há 5 min");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(tooltip()).toContain("Rascunho salvo há 6 min");
  });

  it("lê o relógio a cada renderização, não só no tique do minuto", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 15, 0) });
    const antigo = { ...resumo, atualizadoEm: new Date(2026, 8, 14, 14, 50).toISOString() };
    const { rerender } = render(<TrabalhoAtivo resumo={antigo} ativo={false} onAbrir={vi.fn()} />);
    // Dado novo chega entre dois tiques (ex.: rascunho salvo em outro aparelho).
    vi.setSystemTime(new Date(2026, 8, 14, 15, 0, 50));
    rerender(<TrabalhoAtivo resumo={{ ...antigo, atualizadoEm: new Date(2026, 8, 14, 14, 53, 30).toISOString() }} ativo={false} onAbrir={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Continuar rascunho/ }).getAttribute("title")).toContain("Rascunho salvo há 7 min");
  });
});
