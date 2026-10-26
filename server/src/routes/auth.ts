import { Hono } from "hono";
import { getUsuario } from "../middleware/permissao.js";

// Mantido vazio para que caminhos históricos de senha respondam 404 durante a
// transição. A identidade agora pertence ao Clerk e a sessão chega no middleware.
export const authPublicoRouter = new Hono();

export const authPrivadoRouter = new Hono()
  .get("/auth/me", async (c) => {
    const usuario = getUsuario(c);
    if (!usuario) return c.json({ error: "não autenticado" }, 401);
    return c.json({ usuario });
  });
