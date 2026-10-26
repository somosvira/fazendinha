// Autenticação da API: o Clerk valida a sessão Google, e o Fazendinha resolve
// o usuário interno ativo que determina papel, áreas, flags e escopo.
import type { MiddlewareHandler } from "hono";
import { autenticarRequestClerk } from "../services/auth/clerk.js";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const usuario = await autenticarRequestClerk(c.req.raw);
  if (!usuario) return c.json({ error: "não autenticado" }, 401);
  c.set("usuario", usuario);
  return next();
};
