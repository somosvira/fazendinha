import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => {
  const armazenamento = new Map<string, unknown>();
  return {
    get: vi.fn((k: string) => Promise.resolve(armazenamento.get(k))),
    set: vi.fn((k: string, v: unknown) => {
      armazenamento.set(k, v);
      return Promise.resolve();
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: () => true, subscribe: () => () => {} },
}));

vi.mock("../../propriedadeScope", () => ({
  comPropriedade: (h: Record<string, string> = {}) => h,
}));

function resposta(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("fila", () => {
  it("substitui o id temporário nos itens seguintes depois que o create sincroniza", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => resposta({ id: "42", nome: "Lote X" }))
      .mockImplementationOnce(() => resposta({ id: "99", peso: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const criarLote = enfileirarMutation({
      mutationKey: "corte.criar-lote",
      path: "/corte/lotes",
      method: "POST",
      body: { nome: "Lote X" },
      idTemporarioGerado: "local:abc123",
    });
    const criarPesagem = enfileirarMutation({
      mutationKey: "corte.criar-pesagem",
      path: "/corte/lotes/local:abc123/pesagens",
      method: "POST",
      body: { loteId: "local:abc123", peso: 500 },
    });

    await Promise.all([criarLote, criarPesagem]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/corte/lotes", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ nome: "Lote X" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/corte/lotes/42/pesagens", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ loteId: "42", peso: 500 }),
    }));
  });

  it("processa a fila em sequência — a segunda escrita só começa depois que a primeira responde", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");

    const ordem: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      ordem.push(`start:${url}`);
      return new Promise((resolve) => {
        setTimeout(() => {
          ordem.push(`end:${url}`);
          resolve(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
        }, 20);
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" }),
      enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST" }),
    ]);

    expect(ordem).toEqual(["start:/api/a", "end:/api/a", "start:/api/b", "end:/api/b"]);
  });
});
