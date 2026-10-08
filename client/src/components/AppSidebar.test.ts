// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "./AppSidebar";
import type { Tab } from "./Shell";
import type { User } from "../data/acessos";

const proprietario: User = { id: "u1", nome: "Marco Antônio", email: "marco@riovono.com", inicial: "M", papel: "proprietario", status: "ativo", ultimoAcesso: "hoje", abas: [], flags: [] };

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

  areas: string[];
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  onAbrirBusca: () => void;
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
  user: User;
  colapsada: boolean;
  onToggleColapsar: () => void;
  onAcessos: () => void;
  onSair: () => void;
}> = {}) {
  return {
    current: "dashboard" as Tab,
    onNav: vi.fn(),
    financeiro: [
      { id: "dashboard" as Tab, label: "Dashboard" },
      { id: "lancar" as Tab, label: "Operações" },
      { id: "gastos" as Tab, label: "Gastos" },
      { id: "caixinha" as Tab, label: "Contas e extratos" },
      { id: "cadastros" as Tab, label: "Configurações financeiras" },
    ],
    isAdmin: true,
    areas: ["pecuaria", "agricultura", "equipe"],
    mobileOpen: false,
    onMobileToggle: vi.fn(),
    onAbrirBusca: vi.fn(),
    propAtiva: null,
    onTrocarProp: vi.fn(),
    user: proprietario,
    colapsada: false,
    onToggleColapsar: vi.fn(),
    onAcessos: vi.fn(),
    onSair: vi.fn(),
    ...overrides,
  };
}

describe("AppSidebar", () => {
  it("abre os eixos principais e concentra os cadastros em Configurações", () => {
    render(h(AppSidebar, baseProps()));
    const pecuaria = screen.getByRole("button", { name: "Recolher Pecuária" });
    expect(pecuaria.querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("Agronomia")).toBeNull();
    expect(screen.queryByText("Equipe")).toBeNull();
    expect(screen.getByText("Visão geral")).toBeTruthy();
    expect(screen.getByText("Operações")).toBeTruthy();
    expect(screen.getByText("Compromissos")).toBeTruthy();
    expect(screen.getByText("Contas e extratos")).toBeTruthy();
    expect(screen.getByText("Configurações")).toBeTruthy();
    expect(screen.queryByText("Configurações financeiras")).toBeNull();
    expect(screen.getByText("Sanidade")).toBeTruthy();
    expect(screen.getByText("Pesagem e manejo")).toBeTruthy();
    expect(screen.getByText("Nutrição")).toBeTruthy();
  });

  it("chama onNav com a Tab certa ao clicar num item", () => {
    const props = baseProps();
    render(h(AppSidebar, props));
    fireEvent.click(screen.getByText("Compromissos"));
    expect(props.onNav).toHaveBeenCalledWith("gastos");
  });

  it("a área Pecuária leva ao Rebanho (v1)", () => {
    const props = baseProps({ areas: ["pecuaria"] });
    render(h(AppSidebar, props));
    expect(screen.getAllByText("Pecuária")).toHaveLength(1);
    fireEvent.click(screen.getByText("Rebanho"));
    expect(props.onNav).toHaveBeenCalledWith("pec-rebanho");
    expect(screen.queryByText("Gado de corte")).toBeNull();
  });

  it("normaliza permissões antigas sem duplicar a área", () => {
    render(h(AppSidebar, baseProps({ areas: ["rebanho", "gado_corte"] })));
    expect(screen.getAllByText("Pecuária")).toHaveLength(1);
    expect(screen.getByText("Rebanho")).toBeTruthy();
  });

  it("abre a busca global pelo atalho visível da sidebar", () => {
    const props = baseProps();
    render(h(AppSidebar, props));

    fireEvent.click(screen.getByRole("button", { name: "Buscar páginas, animais e ações" }));
    expect(props.onAbrirBusca).toHaveBeenCalledOnce();
  });

  it("esconde o módulo Equipe & Ponto quando podeVerFolha=false", () => {
    render(h(AppSidebar, baseProps({ })));
    expect(screen.queryByText("Equipe")).toBeNull();
  });

  it("não oferece Equipe mesmo com permissão antiga", () => {
    render(h(AppSidebar, baseProps({ })));
    expect(screen.queryByText("Equipe")).toBeNull();
  });

  it("mostra somente módulos pertencentes às áreas autorizadas", () => {
    render(h(AppSidebar, baseProps({ areas: ["pecuaria"] })));
    expect(screen.getByText("Pecuária")).toBeTruthy();
    expect(screen.queryByText("Agronomia")).toBeNull();
    expect(screen.queryByText("Gado de corte")).toBeNull();
    expect(screen.queryByText("Equipe")).toBeNull();
  });

  it("permite recolher os domínios da sidebar e persiste a escolha", () => {
    render(h(AppSidebar, baseProps()));

    fireEvent.click(screen.getByRole("button", { name: "Recolher Pecuária" }));
    expect(screen.queryByText("Rebanho")).toBeNull();
    expect(screen.getByRole("button", { name: "Expandir Pecuária" })).toBeTruthy();
    expect(localStorage.getItem("rionovo:sidebar:collapsedGroups:v2")).toContain("pecuaria");

    fireEvent.click(screen.getByRole("button", { name: "Recolher Financeiro" }));
    expect(screen.queryByText("Visão geral")).toBeNull();

    expect(screen.queryByText("Compromissos")).toBeNull();
  });

  it("reabre o domínio recolhido quando a navegação entra nele", () => {
    localStorage.setItem("rionovo:sidebar:collapsedGroups:v2", JSON.stringify(["pecuaria"]));
    const { rerender } = render(h(AppSidebar, baseProps({ current: "dashboard" as Tab })));
    expect(screen.queryByText("Rebanho")).toBeNull();

    rerender(h(AppSidebar, baseProps({ current: "pec-rebanho" as Tab })));
    expect(screen.getByText("Rebanho")).toBeTruthy();
  });


  it("monta o drawer mobile (Sheet) quando mobileOpen=true e não quando false", () => {
    const { rerender } = render(h(AppSidebar, baseProps({ mobileOpen: false })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();

    rerender(h(AppSidebar, baseProps({ mobileOpen: true })));
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeTruthy();
  });

  it("mantém o usuário no rodapé e o recolhimento junto à marca", async () => {
    const props = baseProps();
    render(h(AppSidebar, props));
    fireEvent.click(screen.getByLabelText("Recolher menu lateral"));
    expect(props.onToggleColapsar).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByLabelText("Menu da conta"), { button: 0 });
    const acessos = await screen.findByText("Acessos");
    expect(screen.queryByText("Preferências")).toBeNull();
    fireEvent.click(acessos);
    expect(props.onAcessos).toHaveBeenCalledTimes(1);
  });
});
