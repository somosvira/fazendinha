import { afterEach, describe, expect, it, vi } from "vitest";
import { adicionarFertilizacao, aplicarPool, criarColeta, criarGrupoPool, listarEmbrioesDisponiveis } from "./api";

function stubFetch() {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", spy);
  return spy;
}
const chamada = (spy: ReturnType<typeof stubFetch>, i: number) => {
  const call = spy.mock.calls[i];
  if (!call) throw new Error(`sem chamada de fetch no índice ${i}`);
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit & { body?: string } };
};
afterEach(() => vi.unstubAllGlobals());

describe("api FIV", () => {
  it("cria coleta via POST no caminho certo", async () => {
    const spy = stubFetch();
    await criarColeta({ doadoraId: 31, data: "2026-07-27", metodo: "FIV", oocitos: [] });
    const { url, init } = chamada(spy, 0);
    expect(url).toBe("/api/rebanho/fiv/coletas");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body!)).toEqual(expect.objectContaining({ doadoraId: 31 }));
  });

  it("adiciona fertilização no caminho da coleta", async () => {
    const spy = stubFetch();
    await adicionarFertilizacao(10, { reprodutorId: 44, estoqueSemenId: 18 });
    expect(chamada(spy, 0).url).toBe("/api/rebanho/fiv/coletas/10/fertilizacoes");
    expect(chamada(spy, 0).init.method).toBe("POST");
  });

  it("lista embriões disponíveis via GET", async () => {
    const spy = stubFetch();
    await listarEmbrioesDisponiveis();
    expect(chamada(spy, 0).url).toBe("/api/rebanho/fiv/embrioes/disponiveis");
  });

  it("cria grupo e aplica pool nos caminhos certos", async () => {
    const spy = stubFetch();
    await criarGrupoPool({ nome: "Elite", doadoraIds: [31] });
    expect(chamada(spy, 0).url).toBe("/api/rebanho/fiv/pools");
    await aplicarPool(5, { data: "2026-07-27" });
    expect(chamada(spy, 1).url).toBe("/api/rebanho/fiv/pools/5/aplicar");
    expect(chamada(spy, 1).init.method).toBe("POST");
  });
});
