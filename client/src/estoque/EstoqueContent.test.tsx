// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./components/MovimentoForm", () => ({ MovimentoForm: () => null }));
vi.mock("../rebanho/components/ProdutoForm", () => ({ ProdutoForm: () => null }));
vi.mock("./components/PrincipiosAtivosSection", () => ({ PrincipiosAtivosSection: () => null }));
vi.mock("./components/ComposicaoRacaoSection", () => ({ ComposicaoRacaoSection: () => null }));
vi.mock("./components/LotesProdutoSection", () => ({ LotesProdutoSection: () => null }));

import { EstoqueContent } from "./EstoqueContent";

// Espiona o `fetch` global (o `req()` de estoque/api.ts passa por ele) em vez de
// mockar o módulo — `useSaldos` chama `listarSaldos` como identificador local
// dentro do mesmo arquivo, então mockar só o export não intercepta a chamada.
function mockFetch() {
  return vi.fn((url: string) => {
    const body = /\/estoque\/saldos/.test(url) ? [] : /\/estoque\/movimentos/.test(url) ? [] : /\/estoque\/produtos/.test(url) ? [] : /\/estoque\/centros-custo/.test(url)
      ? []
      : /\/estoque\/custo-vaca-dia/.test(url) ? { periodoDias: 30, custoVacaDia: null, vacasEmLactacao: 0, totalConsumo: 0 } : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
});

function chamouSaldos(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.some(([url]) => /\/estoque\/saldos/.test(String(url)));
}

describe("EstoqueContent — filtro inicial vindo do módulo (aguardarFiltro)", () => {
  it("não busca saldos enquanto o filtro ainda não chegou", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={undefined} aguardarFiltro avisoFiltro="Carregando centro…" />);
    expect(chamouSaldos(fetchMock)).toBe(false);
  });

  it("busca saldos assim que o filtro é resolvido (mesmo null)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={null} aguardarFiltro avisoFiltro="Centro não cadastrado" />);
    expect(chamouSaldos(fetchMock)).toBe(true);
    expect(await screen.findByText("Centro não cadastrado")).toBeTruthy();
  });

  it("sem aguardarFiltro (menu /estoque direto) busca saldos de imediato", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent />);
    expect(chamouSaldos(fetchMock)).toBe(true);
  });
});
