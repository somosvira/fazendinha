// Validação da assinatura do webhook da Meta (X-Hub-Signature-256).
// A Meta assina o corpo CRU com HMAC-SHA256 usando o App Secret. Função PURA.

import crypto from "node:crypto";

export function verificarAssinatura(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
