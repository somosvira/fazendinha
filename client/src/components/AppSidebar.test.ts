// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "./AppSidebar";
import type { Tab } from "./Shell";

// PropriedadePicker (bloco de marca) chama usePropriedades — mock offline p/
// o teste não depender de rede/backend.
vi.mock("../rebanho/api", () => ({
  usePropriedades: () => ({ data: [{ id: 1, nome: "Rio Novo", principal: true, ativo: true }], loading: false, recarregar: vi.fn() }),
}));

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

// jsdom não implementa `window.matchMedia` — o efeito que fecha o drawer
// mobile no crossover de 901px (fix da revisão final) chama
// `window.matchMedia("(min-width: 901px)")` a cada render com mobileOpen=true.
// Sem esse stub o teste do Sheet quebra com "matchMedia is not a function".
// `matches: false` simula uma viewport <=900px (o cenário em que o drawer
// mobile existe) — o efeito só adiciona o listener de "change" e não chama
// onMobileToggle de cara, então não interfere nas asserções abaixo.
function makeMatchMediaMock() {
  return (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  vi.stubGlobal("matchMedia", makeMatchMediaMock());
});

function baseProps(overrides: Partial<{
  current: Tab;
  onNav: (t: Tab) => void;
  financeiro: { id: Tab; label: string }[];
  isAdmin: boolean;
  podeVerFolha: boolean;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
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
    propAtiva: null as number | null,
    onTrocarProp: vi.fn(),
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

  it("expande o módulo da aba atual (single-open dirigido pela aba)", () => {
    render(h(AppSidebar, baseProps({ current: "reb-nutricao" as Tab })));
    expect(screen.getByText("Nutrição")).toBeTruthy();  // sub-item do Rebanho, expandido
    expect(screen.queryByText("Safras")).toBeNull();     // Milho fechado
  });

  it("troca o módulo expandido quando a aba muda", () => {
    const { rerender } = render(h(AppSidebar, baseProps({ current: "reb-nutricao" as Tab })));
    expect(screen.getByText("Nutrição")).toBeTruthy();
    rerender(h(AppSidebar, baseProps({ current: "mil-safras" as Tab })));
    expect(screen.getByText("Safras")).toBeTruthy();
    expect(screen.queryByText("Nutrição")).toBeNull();
  });

  it("mostra o meta subtitle do módulo", () => {
    render(h(AppSidebar, baseProps()));
    expect(screen.getByText("gado leiteiro")).toBeTruthy();
  });

  it("mostra o bloco de marca Terrano e o seletor de propriedade", () => {
    render(h(AppSidebar, baseProps()));
    expect(screen.getAllByText("Terrano").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Propriedade \/ sítio/i }).length).toBeGreaterThan(0);
  });

  it("monta o drawer mobile (Sheet) quando mobileOpen=true e não quando false", () => {
    const { rerender } = render(h(AppSidebar, baseProps({ mobileOpen: false })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();

    rerender(h(AppSidebar, baseProps({ mobileOpen: true })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeTruthy();
  });
});
