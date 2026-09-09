import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { autenticar, validarConvite, validarReset, aceitarConvite, redefinirSenha, solicitarRecuperacaoSenha } from "../services/auth/contas.js";
import { criarSessao, revogarSessao } from "../services/auth/sessao.js";
import { getUsuario } from "../middleware/permissao.js";
import { LimiteRecuperacaoSenha } from "../services/auth/rate-limit.js";
import { canalRecuperacaoConfigurado } from "../services/auth/email.js";
import { env } from "../env.js";

const loginSchema = z.object({ email: z.string().email(), senha: z.string().min(1) });
const emailSchema = z.object({ email: z.string().email().max(254) });
const senhaSchema = z.object({ token: z.string().min(1), senha: z.string().min(8, "mínimo 8 caracteres").max(128) });
export const MENSAGEM_RECUPERACAO = "Se existir uma conta com esse e-mail, enviaremos um link para redefinir a senha.";

const limiteRecuperacao = new LimiteRecuperacaoSenha({
  porEmail: env.AUTH_RESET_MAX_PER_EMAIL,
  porOrigem: env.AUTH_RESET_MAX_PER_IP,
  janelaMs: env.AUTH_RESET_RATE_WINDOW_MINUTES * 60_000,
});

function bearer(h: string | undefined): string | null {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

function origem(c: Context): string {
  // O Render acrescenta o hop recebido ao fim da cadeia; usar o último evita
  // confiar no primeiro valor, que o cliente pode forjar ao acessar a API direta.
  const encaminhados = c.req.header("x-forwarded-for")?.split(",").map((item) => item.trim()).filter(Boolean);
  const valor = encaminhados?.at(-1) ?? "desconhecida";
  return valor.slice(0, 128);
}

async function concluirReset(c: Context, token: string, senha: string) {
  const usuario = await redefinirSenha(token, senha);
  if (!usuario) return c.json({ error: "link inválido, expirado ou já utilizado" }, 404);
  const sessao = await criarSessao(usuario.id, c.req.header("user-agent"));
  return c.json({ token: sessao, usuario });
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
  .post("/auth/forgot-password", zValidator("json", emailSchema), async (c) => {
    const { email } = c.req.valid("json");
    if (canalRecuperacaoConfigurado() && limiteRecuperacao.permitir(email, origem(c))) {
      await solicitarRecuperacaoSenha(email).catch((error) => {
        // A resposta pública continua neutra; detalhes ficam somente no log interno.
        console.error("[auth] falha ao entregar recuperação de senha:", error instanceof Error ? error.message : "erro desconhecido");
      });
    }
    return c.json({ message: MENSAGEM_RECUPERACAO }, 202);
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
  .get("/auth/reset-password/:token", async (c) => {
    if (!(await validarReset(c.req.param("token")))) return c.json({ error: "link inválido, expirado ou já utilizado" }, 404);
    return c.json({ valido: true as const });
  })
  .post("/auth/reset-password", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    return concluirReset(c, token, senha);
  })
  // Alias de API durante a transição dos clientes antigos.
  .post("/auth/senha/redefinir", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    return concluirReset(c, token, senha);
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
