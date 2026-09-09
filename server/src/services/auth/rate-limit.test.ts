import { describe, expect, it } from "vitest";
import { LimiteFixo, LimiteRecuperacaoSenha } from "./rate-limit.js";

describe("LimiteRecuperacaoSenha", () => {
  it("limita separadamente por e-mail e por origem e libera após a janela", () => {
    const limite = new LimiteRecuperacaoSenha({ porEmail: 2, porOrigem: 3, janelaMs: 1_000 });

    expect(limite.permitir("fixture-a@example.test", "ip-1", 0)).toBe(true);
    expect(limite.permitir("fixture-a@example.test", "ip-1", 1)).toBe(true);
    expect(limite.permitir("fixture-a@example.test", "ip-2", 2)).toBe(false);

    expect(limite.permitir("fixture-b@example.test", "ip-1", 3)).toBe(true);
    expect(limite.permitir("fixture-c@example.test", "ip-1", 4)).toBe(false);
    expect(limite.permitir("fixture-a@example.test", "ip-1", 1_001)).toBe(true);
  });

  it("não cria novas chaves de e-mail depois que a origem já foi bloqueada", () => {
    const limite = new LimiteRecuperacaoSenha({ porEmail: 1, porOrigem: 1, janelaMs: 1_000 });

    expect(limite.permitir("primeiro@example.test", "ip-bloqueado", 0)).toBe(true);
    expect(limite.permitir("rotacionado@example.test", "ip-bloqueado", 1)).toBe(false);
    expect(limite.permitir("rotacionado@example.test", "outra-origem", 2)).toBe(true);
  });
});

describe("LimiteFixo", () => {
  it("mantém um teto de chaves e reaproveita espaço após a expiração", () => {
    const limite = new LimiteFixo(2, 1_000, 2);

    expect(limite.consumir("a", 0)).toBe(true);
    expect(limite.consumir("b", 1)).toBe(true);
    expect(limite.consumir("c", 2)).toBe(false);
    expect(limite.consumir("c", 1_001)).toBe(true);
  });
});
