import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { autenticar, validarConvite, aceitarConvite, redefinirSenha } from "../services/auth/contas.js";
import { criarSessao, revogarSessao } from "../services/auth/sessao.js";
import { getUsuario } from "../middleware/permissao.js";

const loginSchema = z.object({ email: z.string().email(), senha: z.string().min(1) });
const senhaSchema = z.object({ token: z.string().min(1), senha: z.string().min(8, "mínimo 8 caracteres") });

function bearer(h: string | undefined): string | null {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

// Público — montado ANTES do authMiddleware (não exige sessão).
export const authPublicoRouter = new Hono()
  .post("/auth/login", zValidator("json", loginSchema), async (c) => {
    const { email, senha } = c.req.valid("json");
    const usuario = await autenticar(email, senha);
    if (!usuario) return c.json({ error: "e-mail ou senha inválidos" }, 401);
    const token = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token, usuario });
  })
  .get("/auth/convite/:token", async (c) => {
    const dados = await validarConvite(c.req.param("token"));
    if (!dados) return c.json({ error: "convite inválido ou expirado" }, 404);
    return c.json(dados);
  })
  .post("/auth/convite/aceitar", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    const usuario = await aceitarConvite(token, senha);
    if (!usuario) return c.json({ error: "convite inválido ou expirado" }, 404);
    const sessao = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token: sessao, usuario });
  })
  .post("/auth/senha/redefinir", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    const usuario = await redefinirSenha(token, senha);
    if (!usuario) return c.json({ error: "link inválido ou expirado" }, 404);
    const sessao = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token: sessao, usuario });
  });

// Privado — montado DEPOIS do authMiddleware (precisa de sessão resolvida).
export const authPrivadoRouter = new Hono()
  .post("/auth/logout", async (c) => {
    const raw = bearer(c.req.header("authorization"));
    if (raw) await revogarSessao(raw);
    return c.json({ ok: true });
  })
  .get("/auth/me", async (c) => {
    const u = getUsuario(c);
    if (!u) return c.json({ error: "não autenticado" }, 401);
    return c.json({ usuario: u });
  });
