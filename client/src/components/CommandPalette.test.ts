// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
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

const PLACEHOLDER = "Buscar em tudo…";

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
    expect(screen.getByText("Visão geral")).toBeTruthy();

    // Bloqueando a aba "dashboard" via podeVer, o comando some da lista.
    rerender(h(CommandPalette, baseProps({ podeVer: (t) => t !== "dashboard" })));
    expect(screen.queryByText("Visão geral")).toBeNull();
  });

  it("dispara /api/busca com ≥2 chars, ~200ms de debounce, com os headers de comPropriedade(), e renderiza as entidades", async () => {
    const entidade: ResultadoBusca = {
      caminho: "/financeiro/configuracoes?aba=categorias&busca=Categoria",
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
      caminho: "/financeiro/configuracoes?aba=categorias&busca=Categoria",
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

    expect(props.onNav).toHaveBeenCalledWith("plano", "789", "/financeiro/configuracoes?aba=categorias&busca=Categoria");
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it("filtra as ENTIDADES do backend por podeVer (não renderiza entidade de aba bloqueada)", async () => {
    const entidade: ResultadoBusca = {
      caminho: "/financeiro/configuracoes?aba=categorias&busca=Categoria",
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


describe("busca global integrada", () => {
  it("distingue erro de ausência e oferece nova tentativa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false })); vi.useFakeTimers();
    render(h(CommandPalette, baseProps()));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "inexistente" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(screen.getByText("Não foi possível buscar os registros")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(screen.queryByText(/Nenhum resultado para/)).toBeNull();
  });
  it("remove entidades antigas imediatamente ao mudar a busca", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ tipo: "animal", entidadeId: "184", label: "Estrela 184", sublabel: "Rebanho", tab: "pec-rebanho", grupo: "Animais", caminho: "/pecuaria/rebanho/animais/184" }] }));
    vi.useFakeTimers(); render(h(CommandPalette, baseProps()));
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "184" } }); await vi.advanceTimersByTimeAsync(300);
    expect(screen.getByText("Estrela 184")).toBeTruthy();
    fireEvent.change(input, { target: { value: "outro" } });
    expect(screen.queryByText("Estrela 184")).toBeNull();
  });
  it("troca entre registros e páginas sem perder a consulta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ tipo: "produto", entidadeId: "1", label: "Leite cru", sublabel: "Estoque", tab: "estoque", grupo: "Produtos", caminho: "/estoque/produtos/1" }] }));
    vi.useFakeTimers(); render(h(CommandPalette, baseProps()));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "leite" } }); await vi.advanceTimersByTimeAsync(300);
    fireEvent.click(screen.getByRole("button", { name: "Registros" }));
    expect(screen.getByText("Leite cru")).toBeTruthy(); expect(screen.queryByText("Produção de leite")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Páginas" }));
    expect(screen.queryByText("Leite cru")).toBeNull(); expect(screen.getByText("Produção de leite")).toBeTruthy();
  });
});

it("Enter prioriza o registro encontrado quando a resposta chega depois das páginas", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ tipo: "produto", entidadeId: "p", label: "Leite cru", sublabel: "Estoque", tab: "estoque", grupo: "Produtos", caminho: "/estoque/produtos/p" }] }));
  vi.useFakeTimers(); const props = baseProps(); render(h(CommandPalette, props));
  const input = screen.getByPlaceholderText(PLACEHOLDER);
  fireEvent.change(input, { target: { value: "leite" } }); await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(screen.getByText("Leite cru").closest("[cmdk-item]")?.getAttribute("data-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(props.onNav).toHaveBeenCalledWith("estoque", "p", "/estoque/produtos/p");
});

describe("mini abas por tipo de registro", () => {
  const vaca = { tipo: "animal", entidadeId: "a1", label: "DEV-035 — Estrela", sublabel: "Rebanho › Sede", tab: "pec-rebanho", grupo: "Animais", caminho: "/pecuaria/rebanho/animais/a1" };
  const exame = { tipo: "exame", entidadeId: "e1", label: "Brucelose — DEV-035 — Estrela", sublabel: "Exames › Sede", tab: "pec-sanidade", grupo: "Exames", caminho: "/pecuaria/sanidade?aba=exames&detalheTipo=exame&detalheId=e1" };
  const documento = { tipo: "documento", entidadeId: "d1", label: "Atestado — Estrela", sublabel: "Documentos › Sede", tab: "lancar", grupo: "Documentos financeiros", caminho: "/financeiro/operacoes/o1" };
  async function abrirCom(itens: unknown[]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => itens }));
    vi.useFakeTimers(); const props = baseProps(); render(h(CommandPalette, props));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "estrela" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    return props;
  }
  it("agrupa por família com o animal primeiro, mesmo quando o servidor manda o documento antes", async () => {
    await abrirCom([documento, exame, vaca]);
    const abas = screen.getByRole("navigation", { name: "Tipos de registro" });
    expect([...abas.querySelectorAll("button")].map(b => b.textContent)).toEqual(["Todos3", "Animais1", "Sanidade1", "Financeiro1"]);
    expect(screen.getByText("DEV-035 — Estrela").closest("[cmdk-item]")?.getAttribute("data-selected")).toBe("true");
  });
  it("a mini aba mostra só os registros da família e volta para todos", async () => {
    await abrirCom([vaca, exame, documento]);
    fireEvent.click(screen.getByRole("button", { name: "Sanidade1" }));
    expect(screen.getByText("Brucelose — DEV-035 — Estrela")).toBeTruthy();
    expect(screen.queryByText("DEV-035 — Estrela")).toBeNull();
    expect(screen.queryByText("Atestado — Estrela")).toBeNull();
    expect(screen.getByText("Brucelose — DEV-035 — Estrela").closest("[cmdk-item]")?.getAttribute("data-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Todos3" }));
    expect(screen.getByText("Atestado — Estrela")).toBeTruthy();
  });
  it("não mostra mini abas com uma única família", async () => {
    await abrirCom([vaca]);
    expect(screen.queryByRole("navigation", { name: "Tipos de registro" })).toBeNull();
  });
});

describe("busca só de animais (Ctrl/⌘ Shift K)", () => {
  it("consulta só animais, sem páginas, ações ou mini abas, e abre a ficha", async () => {
    const vaca = { tipo: "animal", entidadeId: "a1", label: "DEV-019 — Lactantes 19", sublabel: "Rebanho › Sede", tab: "pec-rebanho", grupo: "Animais", caminho: "/pecuaria/rebanho/animais/a1" };
    const lote = { tipo: "lote", entidadeId: "l1", label: "Lactantes", sublabel: "Rebanho", tab: "pec-rebanho", grupo: "Lotes de animais", caminho: "/pecuaria/rebanho/lotes/l1" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [vaca, lote] });
    vi.stubGlobal("fetch", fetchMock); vi.useFakeTimers();
    const props = baseProps();
    render(h(CommandPalette, { ...props, modo: "animais" as const }));
    const input = screen.getByPlaceholderText("Buscar animal por brinco ou nome…");
    fireEvent.change(input, { target: { value: "rebanho" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/busca?q=rebanho&tipos=animal");
    expect(screen.getByText("DEV-019 — Lactantes 19")).toBeTruthy();
    expect(screen.queryByText("Lactantes")).toBeNull();
    expect(screen.queryByText("Rebanho")).toBeNull(); // página do catálogo não aparece
    expect(screen.queryByRole("navigation", { name: "Tipos de resultado" })).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onNav).toHaveBeenCalledWith("pec-rebanho", "a1", "/pecuaria/rebanho/animais/a1");
  });
});
