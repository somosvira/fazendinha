import { describe, expect, it, vi } from "vitest";

const chamadas: string[] = [];

vi.mock("../auth", () => ({
  setSessao: vi.fn(() => { chamadas.push("setSessao"); }),
}));
vi.mock("./fila", () => ({
  garantirProcessamento: vi.fn(() => { chamadas.push("garantirProcessamento"); }),
}));

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
