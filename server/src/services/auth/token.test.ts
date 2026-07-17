import { describe, it, expect } from "vitest";
import { gerarToken, hashToken, tokenExpirado, expiraConvite, expiraReset } from "./token.js";

describe("token", () => {
  it("gerarToken devolve raw hex de 64 chars e hash consistente", () => {
    const { raw, hash } = gerarToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(raw));
    expect(hash).not.toBe(raw);
  });

  it("dois tokens diferem", () => {
    expect(gerarToken().raw).not.toBe(gerarToken().raw);
  });

  it("tokenExpirado: passado → true, futuro → false", () => {
    const agora = new Date("2026-07-14T12:00:00Z");
    expect(tokenExpirado(new Date("2026-07-14T11:00:00Z"), agora)).toBe(true);
    expect(tokenExpirado(new Date("2026-07-14T13:00:00Z"), agora)).toBe(false);
  });

  it("expiraConvite = +7 dias; expiraReset = +1 hora", () => {
    const agora = new Date("2026-07-14T12:00:00Z");
    expect(expiraConvite(agora).toISOString()).toBe("2026-07-21T12:00:00.000Z");
    expect(expiraReset(agora).toISOString()).toBe("2026-07-14T13:00:00.000Z");
  });
});
