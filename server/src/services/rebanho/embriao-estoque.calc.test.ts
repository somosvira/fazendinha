import { describe, expect, it } from "vitest";
import { planejarDevolucaoEmbriao, planejarTransferenciaEmbriao } from "./embriao-estoque.calc.js";

describe("planejarTransferenciaEmbriao", () => {
  it("transfere somente embrião disponível", () => {
    expect(planejarTransferenciaEmbriao({ estadoAtual: "DISPONIVEL" })).toEqual({ transferir: true, novoEstado: "TRANSFERIDO", erro: null });
  });

  it.each(["TRANSFERIDO", "DESCARTADO"] as const)("recusa embrião %s", (estadoAtual) => {
    expect(planejarTransferenciaEmbriao({ estadoAtual })).toEqual({ transferir: false, novoEstado: estadoAtual, erro: "EMBRIAO_INDISPONIVEL" });
  });
});

describe("planejarDevolucaoEmbriao", () => {
  it("devolve embrião transferido para disponível", () => {
    expect(planejarDevolucaoEmbriao({ estadoAtual: "TRANSFERIDO" })).toEqual({ devolver: true, novoEstado: "DISPONIVEL" });
  });

  it.each(["DISPONIVEL", "DESCARTADO"] as const)("não altera embrião %s", (estadoAtual) => {
    expect(planejarDevolucaoEmbriao({ estadoAtual })).toEqual({ devolver: false, novoEstado: estadoAtual });
  });
});
