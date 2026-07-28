import { afterEach, describe, expect, it, vi } from "vitest";
import { obterRelatorioReproducao } from "./api";

function stubFetch() {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ periodo: { de: null, ate: null }, coberturas: 0, prenhes: 0, partos: 0, taxaConcepcao: null, porMetodo: [] }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", spy);
  return spy;
}
afterEach(() => vi.unstubAllGlobals());

describe("api relatório reprodutivo", () => {
  it("busca sem janela no caminho certo", async () => {
    const spy = stubFetch();
    await obterRelatorioReproducao();
    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/reproducao/relatorio");
  });

  it("passa de/ate como querystring", async () => {
    const spy = stubFetch();
    await obterRelatorioReproducao("2026-01-01", "2026-06-30");
    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/reproducao/relatorio?de=2026-01-01&ate=2026-06-30");
  });
});
