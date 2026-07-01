import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verificarAssinatura } from "./verify.js";

const secret = "meu-app-secret";
const sign = (body: string) => "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verificarAssinatura", () => {
  it("aceita assinatura válida", () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verificarAssinatura(body, sign(body), secret)).toBe(true);
  });

  it("rejeita corpo adulterado", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const sig = sign(body);
    expect(verificarAssinatura(body + " ", sig, secret)).toBe(false);
  });

  it("rejeita assinatura ausente", () => {
    expect(verificarAssinatura("{}", undefined, secret)).toBe(false);
  });

  it("rejeita secret errado", () => {
    const body = "{}";
    expect(verificarAssinatura(body, sign(body), "outro-secret")).toBe(false);
  });
});
