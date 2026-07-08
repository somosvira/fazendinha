// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "./AppSidebar";
import type { Tab } from "./Shell";

// Node 22+ define um `localStorage` global "experimental" (atrás de
// --localstorage-file) que sombreia o do jsdom e quebra com "Cannot read
// properties of undefined" — substituímos por um mock em memória via
// `vi.stubGlobal` só para este arquivo de teste (não afeta o componente,
// que já guarda o acesso real em try/catch para o caso de storage indisponível).
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => vi.stubGlobal("localStorage", makeLocalStorageMock()));

function baseProps(overrides: Partial<{
  current: Tab;
  onNav: (t: Tab) => void;
  financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  podeVerFolha: boolean;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
}> = {}) {
  return {
    current: "dashboard" as Tab,
    onNav: vi.fn(),
    financeiro: [
      { id: "dashboard" as Tab, label: "Dashboard" },
      { id: "gastos" as Tab, label: "Gastos" },
    ],
    isAdmin: true,
    podeVerFolha: true,
    mobileOpen: false,
    onMobileToggle: vi.fn(),
    ...overrides,
  };
}

describe("AppSidebar", () => {
  it("chama onNav com a Tab certa ao clicar num item", () => {
    const props = baseProps();
    render(h(AppSidebar, props));
    fireEvent.click(screen.getByText("Gastos"));
    expect(props.onNav).toHaveBeenCalledWith("gastos");
  });

  it("esconde o módulo Equipe & Ponto quando podeVerFolha=false", () => {
    render(h(AppSidebar, baseProps({ podeVerFolha: false })));
    expect(screen.queryByText("Equipe & Ponto")).toBeNull();
  });

  it("mostra o módulo Equipe & Ponto quando podeVerFolha=true", () => {
    render(h(AppSidebar, baseProps({ podeVerFolha: true })));
    expect(screen.getByText("Equipe & Ponto")).toBeTruthy();
  });

  it("clicar no cabeçalho de um módulo alterna (acordeão) seus sub-itens", () => {
    render(h(AppSidebar, baseProps()));
    // Sem localStorage e current="dashboard" (não pertence a nenhum módulo),
    // o 1º módulo não-desabilitado ("Rebanho leiteiro") abre por padrão.
    expect(screen.getByText("Painel")).toBeTruthy();

    fireEvent.click(screen.getByText("Rebanho leiteiro"));
    expect(screen.queryByText("Painel")).toBeNull();

    fireEvent.click(screen.getByText("Rebanho leiteiro"));
    expect(screen.getByText("Painel")).toBeTruthy();
  });

  it("persiste o módulo aberto no localStorage e abre automaticamente o módulo da aba atual ao navegar", () => {
    const { rerender } = render(h(AppSidebar, baseProps()));

    fireEvent.click(screen.getByText("Milho"));
    expect(localStorage.getItem("rionovo:sidebar:openModulo")).toBe("cultivo");
    expect(screen.getByText("Safras")).toBeTruthy();

    // navega (via prop `current`, como o App faria) para uma aba de outro módulo:
    // o efeito de auto-open deve trocar o acordeão sem clique no cabeçalho.
    rerender(h(AppSidebar, baseProps({ current: "reb-nutricao" as Tab })));
    expect(screen.getByText("Nutrição")).toBeTruthy();
    expect(screen.queryByText("Safras")).toBeNull();
  });

  it("monta o drawer mobile (Sheet) quando mobileOpen=true e não quando false", () => {
    const { rerender } = render(h(AppSidebar, baseProps({ mobileOpen: false })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();

    rerender(h(AppSidebar, baseProps({ mobileOpen: true })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeTruthy();
  });
});
