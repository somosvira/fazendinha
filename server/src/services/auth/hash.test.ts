import { describe, it, expect } from "vitest";
import { hashSenha, verificarSenha } from "./hash.js";

describe("hashSenha / verificarSenha", () => {
  it("hash não é a senha em claro e tem o prefixo scrypt", () => {
    const h = hashSenha("segredo-forte-123");
    expect(h).not.toContain("segredo-forte-123");
    expect(h.startsWith("scrypt$")).toBe(true);
  });

  it("verifica a senha correta", () => {
    const h = hashSenha("senhaCorreta!");
    expect(verificarSenha("senhaCorreta!", h)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const h = hashSenha("senhaCorreta!");
    expect(verificarSenha("outraCoisa", h)).toBe(false);
  });

  it("dois hashes da mesma senha diferem (salt aleatório)", () => {
    expect(hashSenha("igual")).not.toBe(hashSenha("igual"));
  });

  it("formato inválido → false, sem lançar", () => {
    expect(verificarSenha("x", "lixo")).toBe(false);
    expect(verificarSenha("x", "")).toBe(false);
  });
});
