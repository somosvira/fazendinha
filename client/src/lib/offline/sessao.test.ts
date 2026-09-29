import { describe, expect, it, vi } from "vitest";

const chamadas: string[] = [];

vi.mock("../auth", () => ({
  setSessao: vi.fn(() => { chamadas.push("setSessao"); }),
}));
vi.mock("./fila", () => ({
  garantirProcessamento: vi.fn(() => { chamadas.push("garantirProcessamento"); }),
}));

const limpezas: string[] = [];
vi.mock("./queryClient", () => ({ queryClient: { clear: vi.fn(() => { limpezas.push("clear"); }) } }));
vi.mock("./persister", () => ({ persister: { removeClient: vi.fn(async () => { limpezas.push("removeClient"); }) } }));

describe("iniciarSessao", () => {
  it("grava a sessão nova antes de retomar a fila", async () => {
    const { iniciarSessao } = await import("./sessao");
    const { setSessao } = await import("../auth");
    const usuario = { id: 1, nome: "Marco" } as never;

    iniciarSessao("token-novo", usuario);

    expect(setSessao).toHaveBeenCalledWith("token-novo", usuario);
    expect(chamadas).toEqual(["setSessao", "garantirProcessamento"]);
  });
});

describe("limparCacheDaSessao", () => {
  it("limpa o cache em memória e o persistido, sem tocar na fila", async () => {
    const { limparCacheDaSessao } = await import("./sessao");
    const fila = await import("./fila");
    vi.mocked(fila.garantirProcessamento).mockClear();

    limparCacheDaSessao();

    expect(limpezas).toEqual(["clear", "removeClient"]);
    expect(fila.garantirProcessamento).not.toHaveBeenCalled();
  });
});
