// Auth por sessão: resolve `Authorization: Bearer <token>` → Sessao → Usuario e
// injeta em c.set("usuario"). Rotas isentas (health, whatsapp, auth públicas)
// são montadas ANTES deste middleware no index.ts.
import type { MiddlewareHandler } from "hono";
import crypto from "node:crypto";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { resolverSessao, type UsuarioContexto } from "../services/auth/sessao.js";
import { aplicarPreset } from "../services/auth/papeis.js";

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

// Dono sintético para a ponte da senha compartilhada (rollout). Acesso total.
function donoSintetico(): UsuarioContexto {
  const preset = aplicarPreset("proprietario");
  return { id: 0, nome: "Proprietário", email: "", papel: "proprietario", abas: preset.abas, areas: preset.areas, flags: preset.flags, status: "ATIVO", dono: true };
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const recebido = bearer(c.req.header("authorization"));

  // Ponte de transição: enquanto SHARED_ACCESS_TOKEN estiver setado, ele vale
  // como acesso de dono. Remover quando as contas reais estiverem de pé.
  if (env.SHARED_ACCESS_TOKEN && recebido && timingSafeMatch(recebido, env.SHARED_ACCESS_TOKEN)) {
    c.set("usuario", donoSintetico());
    return next();
  }

  if (recebido) {
    const usuario = await resolverSessao(recebido);
    if (usuario) {
      c.set("usuario", usuario);
      return next();
    }
  }

  // Dev local porta aberta: sem SHARED_ACCESS_TOKEN e sem nenhum usuário no banco.
  if (!env.SHARED_ACCESS_TOKEN) {
    const total = await prisma.usuario.count();
    if (total === 0) {
      c.set("usuario", donoSintetico());
      return next();
    }
  }

  return c.json({ error: "não autenticado" }, 401);
};
