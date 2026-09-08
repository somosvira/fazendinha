import { describe, expect, it } from "vitest";
import { LimiteRecuperacaoSenha } from "./rate-limit.js";

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
});
