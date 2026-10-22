// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function usuario(id: number) {
  localStorage.setItem("rionovo:usuario", JSON.stringify({ id }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());

describe("sítio ativo na aba", () => {
  it("restaura a seleção e o header após recarregar os módulos", async () => {
    usuario(1);
    localStorage.setItem("rionovo:auth-token", "sessao-teste");
    const escopo = await import("./propriedadeScope");
    escopo.setPropriedadeAtiva(2);
    vi.resetModules();
    const recarregado = await import("./propriedadeScope");
    expect(recarregado.getPropriedadeAtiva()).toBe(2);
    expect(recarregado.comPropriedade()).toEqual({ authorization: "Bearer sessao-teste", "X-Propriedade-Id": "2" });
    recarregado.setPropriedadeAtiva(null);
    vi.resetModules();
    expect((await import("./propriedadeScope")).getPropriedadeAtiva()).toBeNull();
  });

  it("isola contas e limpa o escopo em memória ao sair", async () => {
    usuario(1);
    const escopo = await import("./propriedadeScope");
    escopo.setPropriedadeAtiva(2);
    usuario(3);
    expect(escopo.getPropriedadeAtiva()).toBeNull();
    escopo.setPropriedadeAtiva(4);
    usuario(1);
    expect(escopo.getPropriedadeAtiva()).toBe(2);
    localStorage.removeItem("rionovo:usuario");
    expect(escopo.getPropriedadeAtiva()).toBeNull();
  });

  it.each(["", "-1", "0", "1.5", "NaN", "2147483648"])("ignora preferência inválida %s", async (valor) => {
    usuario(1);
    sessionStorage.setItem("terrano:sitio-ativo:1", valor);
    expect((await import("./propriedadeScope")).getPropriedadeAtiva()).toBeNull();
  });

  it("continua funcionando sem sessionStorage disponível", async () => {
    usuario(1);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, chave: string) {
      if (this === sessionStorage) throw new Error("Armazenamento indisponível");
      return chave === "rionovo:usuario" ? JSON.stringify({ id: 1 }) : null;
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Armazenamento indisponível"); });
    const escopo = await import("./propriedadeScope");
    escopo.setPropriedadeAtiva(2);
    expect(escopo.getPropriedadeAtiva()).toBe(2);
    expect(escopo.comPropriedade()).toEqual({ "X-Propriedade-Id": "2" });
  });
});
