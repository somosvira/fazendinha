// Middleware de auth mínima (piloto): valida `Authorization: Bearer <token>`
// contra `env.SHARED_ACCESS_TOKEN`. Objetivo é fechar a porta durante a fase
// de teste com o dono da fazenda — NÃO é sistema de usuários/roles/JWT.
//
// - Se `SHARED_ACCESS_TOKEN` não estiver setado, o middleware libera acesso
//   (usado em dev local; simplifica o fluxo até o Bloco 5 do sprint pré-teste).
// - Comparação com `crypto.timingSafeEqual` para evitar timing attack.
// - Rotas isentas (health, webhook do WhatsApp) devem ser montadas ANTES do
//   `app.use("/api/*", authMiddleware)` no `index.ts`.

import type { MiddlewareHandler } from "hono";
import crypto from "node:crypto";
import { env } from "../env.js";

// Rotas que devem passar sem token: healthcheck do Render e webhook da Meta
// (que valida por outra via — assinatura HMAC em services/whatsapp/verify.ts).
const ISENTAS = [/^\/api\/health(?:\/|$)/, /^\/api\/whatsapp(?:\/|$)/];

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function timingSafeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const esperado = env.SHARED_ACCESS_TOKEN;
  if (!esperado) return next(); // dev local: porta aberta
  const path = new URL(c.req.url).pathname;
  if (ISENTAS.some((re) => re.test(path))) return next();
  const recebido = bearer(c.req.header("authorization"));
  if (!recebido || !timingSafeMatch(recebido, esperado)) {
    return c.json({ error: "não autenticado" }, 401);
  }
  return next();
};
