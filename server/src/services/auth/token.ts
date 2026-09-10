// Tokens opacos (sessão, convite, reset): 32 bytes aleatórios entregues crus
// UMA vez; no banco guardamos só o sha256. Helpers de expiração puros.
import crypto from "node:crypto";

export const RESET_TOKEN_TTL_MINUTES = 60;

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function gerarToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function tokenExpirado(expiraEm: Date, agora: Date = new Date()): boolean {
  return expiraEm.getTime() <= agora.getTime();
}

export function expiraConvite(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function expiraReset(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}
