// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { revisarBloqueioParticipacao } from "./revisao-impacto-api";
afterEach(() => vi.unstubAllGlobals());
it("envia revisão esperada, decisão e sítio ao endpoint sanitário existente", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ id: "p", bloqueadaEm: null, canceladaEm: null }),
    });
  vi.stubGlobal("fetch", fetchMock);
  const input = {
    propriedadeId: 7,
    bloqueadaEm: "2026-11-08T12:00:00.000Z",
    destino: "RETOMAR" as const,
    motivo: "Revisão conferida",
    chave: "chave",
  };
  await revisarBloqueioParticipacao("p", input);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/pecuaria/rebanho/sanidade/participacoes/p/revisao-impacto",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-Propriedade-Id": "7" }),
      body: JSON.stringify(input),
    }),
  );
});
