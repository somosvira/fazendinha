import { afterEach, describe, expect, it, vi } from "vitest";
import { listarColetas, prepararColeta } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("contrato HTTP das coletas", () => {
  it("consulta o destino canônico sem barra final e envia filtro antes da paginação", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ itens: [], total: 0 }) });
    vi.stubGlobal("fetch", fetchMock);
    await listarColetas(2, "PESAGEM");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/coletas?pagina=2&tipo=PESAGEM");
  });
  it("prepara no mesmo destino canônico", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "ficha" }) });
    vi.stubGlobal("fetch", fetchMock);
    const body = { id: "ficha", propriedadeId: 1, data: "2026-10-07", tipo: "PESAGEM" as const, titulo: "Pesagens", loteIds: ["lote"] };
    await prepararColeta(body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/coletas");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(body) });
  });
});
