// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./components/MovimentoForm", () => ({ MovimentoForm: () => null }));
vi.mock("../financeiro/FormProduto", () => ({ FormProduto: () => null }));

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

describe("EstoqueContent — filtro inicial vindo do módulo", () => {
  it("busca saldos já com o centro quando `centroCustoIdInicial` é passado (número)", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={5} />);
    const chamada = fetchMock.mock.calls.find(([url]) => /\/estoque\/saldos/.test(String(url)));
    expect(chamada).toBeTruthy();
    expect(String(chamada![0])).toContain("centroCustoId=5");
    // exatamente 1 chamada a saldos — sem uma busca sem filtro antes.
    expect(fetchMock.mock.calls.filter(([url]) => /\/estoque\/saldos/.test(String(url)))).toHaveLength(1);
  });

  it("busca saldos assim que o filtro é resolvido (mesmo null, sem centro cadastrado)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={null} avisoFiltro="Centro não cadastrado" />);
    expect(chamouSaldos(fetchMock)).toBe(true);
    expect(await screen.findByText("Centro não cadastrado")).toBeTruthy();
  });

  it("sem centroCustoIdInicial (menu /estoque direto) busca saldos sem filtro uma vez", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent />);
    const chamadasSaldos = fetchMock.mock.calls.filter(([url]) => /\/estoque\/saldos/.test(String(url)));
    expect(chamadasSaldos).toHaveLength(1);
    expect(String(chamadasSaldos[0][0])).not.toContain("centroCustoId");
  });
});

describe("EstoqueContent — custo médio", () => {
  it("mostra custo médio e valor (saldo × médio); sem custo, '—' e aviso de produtos sem custo apurado", async () => {
    const saldos = [
      { produtoId: 1, nome: "Ração", categoria: { id: 1, nome: "Alimentação", usoSanitario: false, usoNutricional: true, usoAgricola: false }, unidade: "kg", centrosCusto: [], saldo: 15, custoMedio: 6, valor: 90, minimoEstoque: null, abaixoMinimo: false },
      { produtoId: 2, nome: "Sal", categoria: { id: 2, nome: "Mineral", usoSanitario: false, usoNutricional: true, usoAgricola: false }, unidade: "kg", centrosCusto: [], saldo: 4, custoMedio: null, valor: 0, minimoEstoque: null, abaixoMinimo: false },
    ];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const body = /\/estoque\/saldos/.test(url) ? saldos : /\/estoque\/custo-vaca-dia/.test(url) ? { periodoDias: 30, custoVacaDia: null, vacasEmLactacao: 0, totalConsumo: 0 } : [];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }));
    render(<EstoqueContent />);
    const racao = (await screen.findByText("Ração")).closest("tr")!;
    const celulas = [...racao.querySelectorAll("td")].map((td) => td.textContent?.replaceAll(" ", " "));
    expect(celulas).toContain("R$ 6,00");
    expect(celulas).toContain("R$ 90,00");
    const sal = screen.getByText("Sal").closest("tr")!;
    expect([...sal.querySelectorAll("td")].filter((td) => td.textContent === "—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1 produto sem custo apurado — registre uma compra ou um inventário inicial com valor.")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Custo médio" }).getAttribute("title")).toBe("Média ponderada das entradas neste sítio");
  });
});
