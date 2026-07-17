// Hash de senha com scrypt (KDF nativo do Node). Formato codificado:
// scrypt$N$r$p$<saltBase64>$<hashBase64>. Comparação timing-safe.
import crypto from "node:crypto";

const N = 16384; // custo CPU/memória
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verificarSenha(senha: string, codificado: string): boolean {
  const partes = codificado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const esperado = Buffer.from(hashB64, "base64");
    const derivado = crypto.scryptSync(senha, salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derivado.length === esperado.length && crypto.timingSafeEqual(derivado, esperado);
  } catch {
    return false;
  }
}
