import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aplicarAptidaoAutomatica,
  listarAptidoes,
  listarResultadosGinecologicos,
  registrarAptidao,
  sugerirAptidoesAutomaticas,
} from "./api";

function resposta(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("API do ciclo reprodutivo básico", () => {
  it("lista e registra aptidão no animal", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => resposta([]))
      .mockImplementationOnce(() => resposta({ id: 9 }));
    vi.stubGlobal("fetch", fetchMock);

    await listarAptidoes("31");
    await registrarAptidao("31", { data: "2026-07-26", apta: false, motivo: "Avaliação clínica" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/animais/31/aptidao", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/animais/31/aptidao", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ data: "2026-07-26", apta: false, motivo: "Avaliação clínica" }),
    }));
  });

  it("busca sugestões, aplica em lote e lista o dicionário oficial", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => resposta([]))
      .mockImplementationOnce(() => resposta({ data: "2026-07-26", candidatas: 0, aplicadas: 0, ignoradas: 0 }))
      .mockImplementationOnce(() => resposta([]));
    vi.stubGlobal("fetch", fetchMock);

    await sugerirAptidoesAutomaticas();
    await aplicarAptidaoAutomatica("2026-07-26");
    await listarResultadosGinecologicos();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/aptidao/sugestoes", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/aptidao/aplicar", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ data: "2026-07-26" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/rebanho/resultados-ginecologicos", expect.any(Object));
  });
});
