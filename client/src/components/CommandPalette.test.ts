// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import type { Tab } from "./Shell";
import type { ResultadoBusca } from "../lib/searchIndex";
import { setPropriedadeAtiva } from "../propriedadeScope";

// Node 22+ define um `localStorage` global "experimental" que sombreia o do
// jsdom e quebra com "Cannot read properties of undefined" — mesma pegadinha
// documentada em AppSidebar.test.ts. `lib/auth.ts` (via `comPropriedade` →
// `comAuth` → `getToken`) já guarda o acesso real em try/catch, então isto é
// só para deixar o ambiente determinístico neste arquivo de teste.
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

// jsdom não implementa `ResizeObserver` (cmdk usa para recalcular a lista) —
// stub mínimo só para este arquivo de teste, sem efeito no componente real.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const PLACEHOLDER = "Pesquisar páginas, ações e recursos…";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setPropriedadeAtiva(null); // não vaza sítio ativo entre testes
});
beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  // jsdom também não implementa `Element.scrollIntoView` (cmdk chama ao rolar
  // o item ativo pra dentro da viewport da lista).
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

function baseProps(overrides: Partial<{
  aberto: boolean;
  onFechar: () => void;
  onNav: (t: Tab, entidadeId?: string) => void;
  podeVer: (t: Tab) => boolean;
}> = {}) {
  return {
    aberto: true,
    onFechar: vi.fn(),
    onNav: vi.fn(),
    podeVer: () => true,
    ...overrides,
  };
}

describe("CommandPalette", () => {
  it("renderiza comandos do índice estático ao digitar, filtrados por podeVer", () => {
    // "dashboard" só casa com um comando em todo o índice (fin-dashboard,
    // label exata "Dashboard" — os outros módulos usam o label "Painel").
    const { rerender } = render(h(CommandPalette, baseProps()));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "dashboard" } });
    expect(screen.getByText("Dashboard")).toBeTruthy();

    // Bloqueando a aba "dashboard" via podeVer, o comando some da lista.
    rerender(h(CommandPalette, baseProps({ podeVer: (t) => t !== "dashboard" })));
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("dispara /api/busca com ≥2 chars, ~200ms de debounce, com os headers de comPropriedade(), e renderiza as entidades", async () => {
    const entidade: ResultadoBusca = {
      tipo: "categoria",
      entidadeId: "42",
      label: "Talhão da Serra",
      sublabel: "Plantio · 3,2 ha",
      tab: "plano",
      grupo: "Categorias",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [entidade] });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    // Sítio ativo → comPropriedade() passa a devolver um header NÃO-trivial
    // (X-Propriedade-Id: "7"). Assim a asserção prova que o fetch usa mesmo o
    // helper — não passaria com um `headers: {}` literal na tela.
    setPropriedadeAtiva(7);

    render(h(CommandPalette, baseProps()));
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "s" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).not.toHaveBeenCalled(); // 1 char — não busca ainda

    fireEvent.change(input, { target: { value: "se" } });
    await vi.advanceTimersByTimeAsync(300); // > 200ms de debounce

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/busca?q=se");
    // Com sítio 7 ativo, comPropriedade() injeta o X-Propriedade-Id; se alguém
    // trocar `headers: comPropriedade()` por um `{}` literal, esta asserção quebra.
    expect(init.headers).toEqual({ "X-Propriedade-Id": "7" });

    expect(screen.getByText("Talhão da Serra")).toBeTruthy();
    expect(screen.getByText("Plantio · 3,2 ha")).toBeTruthy();
  });

  it("selecionar uma linha de entidade chama onNav(tab, entidadeId) e fecha", async () => {
    const entidade: ResultadoBusca = {
      tipo: "categoria",
      entidadeId: "789",
      label: "Categoria 789",
      sublabel: "Categoria financeira",
      tab: "plano",
      grupo: "Categorias",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [entidade] }));
    vi.useFakeTimers();

    const props = baseProps();
    render(h(CommandPalette, props));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "talh" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(screen.getByText("Categoria 789")).toBeTruthy();

    fireEvent.click(screen.getByText("Categoria 789"));

    expect(props.onNav).toHaveBeenCalledWith("plano", "789");
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it("filtra as ENTIDADES do backend por podeVer (não renderiza entidade de aba bloqueada)", async () => {
    const entidade: ResultadoBusca = {
      tipo: "categoria",
      entidadeId: "789",
      label: "Categoria 789",
      sublabel: "Categoria financeira",
      tab: "plano",
      grupo: "Categorias",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [entidade] }));
    vi.useFakeTimers();

    // podeVer rejeita a aba da entidade → a linha não deve aparecer, mesmo o
    // backend tendo retornado o item (espelha o filtro do índice estático).
    render(h(CommandPalette, baseProps({ podeVer: (t) => t !== "plano" })));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "talh" } });
    await vi.advanceTimersByTimeAsync(300);

    expect(screen.queryByText("Categoria 789")).toBeNull();
  });

  it("não renderiza o diálogo quando aberto=false", () => {
    render(h(CommandPalette, baseProps({ aberto: false })));
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });
});
