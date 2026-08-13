import type { Context, MiddlewareHandler } from "hono";
import { temArea, temPermissao, type Area, type Flag } from "../services/auth/papeis.js";
import type { UsuarioContexto } from "../services/auth/sessao.js";

export function getUsuario(c: Context): UsuarioContexto | null {
  return (c.get("usuario") as UsuarioContexto | undefined) ?? null;
}

export function exigeArea(area: Area): MiddlewareHandler {
  return async (c, next) => {
    const u = getUsuario(c);
    if (!u) return c.json({ error: "não autenticado" }, 401);
    if (!temArea(u, area)) return c.json({ error: "sem acesso a esta área" }, 403);
    return next();
  };
}

export function exigePermissao(flag: Flag): MiddlewareHandler {
  return async (c, next) => {
    const u = getUsuario(c);
    if (!u) return c.json({ error: "não autenticado" }, 401);
    if (!temPermissao(u, flag)) return c.json({ error: "sem permissão" }, 403);
    return next();
  };
}
